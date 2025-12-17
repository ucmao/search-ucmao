import logging
import time

# 导入配置：新增 BAIDU_PAN_COOKIE
from configs.app_config import QUARK_PAN_COOKIE, BAIDU_PAN_COOKIE

logger = logging.getLogger(__name__)

# 导入 Quark 和新增 Baidu 类
from src.clients.quark_client import Quark
from src.clients.baidu_client import Baidu
from src.db.resources_dao import insert_resource, delete_by_share_link, update_share_link
from utils.netdisk_utils import match_netdisk_link


def _handle_netdisk_operation(client_class, client_cookie, share_url, to_pdir_path: str = '/', operation: str = 'store',
                              file_id: str = None):
    """
    通用网盘操作处理器（转存/分享 或 删除）。

    :param client_class: 要实例化的网盘客户端类 (Quark 或 Baidu)。
    :param client_cookie: 客户端的 Cookie。
    :param share_url: 原始分享链接。
    :param to_pdir_path: 目标转存路径（仅对 store 有效）。
    :param operation: 执行的操作 ('store' 或 'delete')。
    :param file_id: 要删除的文件的 ID（仅对 delete 有效）。
    :return:
        - store: (new_file_id, file_name, new_share_url) 或 (None, None, None)
        - delete: True/False
    """
    if not client_cookie:
        logger.error(f"网盘客户端 {client_class.__name__} 的 Cookie 未配置，操作终止。")
        if operation == 'store':
            return None, None, None
        return False

    client = client_class(client_cookie)

    try:
        if operation == 'store':
            # 调用 store 方法：完成解析、转存和创建分享链接的完整流程
            # 注意：百度客户端的 store 方法默认路径为 '/'
            if client_class == Baidu:
                new_file_id, file_name, new_share_url = client.store(share_url, to_pdir_path)
            else:  # Quark
                new_file_id, file_name, new_share_url = client.store(share_url, to_pdir_path)

            if not new_file_id or not new_share_url:
                logger.error(f"处理 {client_class.__name__} 链接失败: {share_url}")
                return None, None, None

            logger.info(
                f"成功处理 {client_class.__name__} 链接，文件ID: {new_file_id}, 文件名: {file_name}, 新分享链接: {new_share_url}")

            # 增加延迟，避免 API 限流
            time.sleep(0.5)
            return new_file_id, file_name, new_share_url

        elif operation == 'delete':
            # 调用 del_file 方法
            if not file_id:
                logger.error("删除操作缺少 file_id。")
                return False

            # 百度客户端的 del_file 接受路径列表，夸克客户端接受单个 ID
            if client_class == Baidu:
                # 假设 file_id 存储的是百度网盘的完整路径，从数据库获取
                file_path = file_id  # 在百度网盘中，file_id通常是fs_id，但删除接口需要路径
                status = client.del_file([file_path])
            else:  # Quark
                status = client.del_file(file_id)

            if status:
                logger.info(f"成功执行 {client_class.__name__} 文件删除操作，ID/路径: {file_id}")
            else:
                logger.error(f"{client_class.__name__} 删除文件操作失败，ID/路径: {file_id}")
            return status

    except Exception as e:
        logger.error(f"处理 {client_class.__name__} 链接时发生异常: {e}")
        if operation == 'store':
            return None, None, None
        return False


def create_share(share_data):
    """
    创建分享链接 (支持夸克和百度网盘)
    :param share_data: 分享数据，包含 share_url, title, save_to_netdisk 等
    :return: 如果是从搜索路由调用（无id），返回处理结果；否则返回None
    """
    try:
        logger.info(f"开始处理分享，分享数据: {share_data}")

        share_url = share_data['share_url']
        title = share_data.get('title', f"未命名资源_{time.time()}")
        save_to_netdisk = share_data.get('save_to_netdisk', {})

        has_id = 'id' in share_data
        share_id = share_data.get('id')

        # 1. 确定网盘类型和是否需要转存
        netdisk_type = match_netdisk_link(share_url)
        to_quark = (netdisk_type == "夸克网盘" and save_to_netdisk.get('quark', False))
        to_baidu = (netdisk_type == "百度网盘" and save_to_netdisk.get('baidu', False))

        if to_quark:
            logger.info(f"检测到夸克网盘链接且用户选择转存，开始处理: {share_url}")
            client_class = Quark
            client_cookie = QUARK_PAN_COOKIE
        elif to_baidu:
            logger.info(f"检测到百度网盘链接且用户选择转存，开始处理: {share_url}")
            client_class = Baidu
            client_cookie = BAIDU_PAN_COOKIE
        else:
            logger.info(f"无需执行网盘替换操作: {share_url}")
            # 如果是从搜索路由调用且无需转存，返回原始数据
            if not has_id:
                return share_data
            return

        # 2. 执行转存、分享操作
        new_file_id, file_name, new_share_url = _handle_netdisk_operation(
            client_class=client_class,
            client_cookie=client_cookie,
            share_url=share_url,
            operation='store'
        )

        if not new_file_id or not new_share_url:
            logger.error(f"处理 {netdisk_type} 网盘链接失败: {share_url}")
            if not has_id:
                return None
            return

        # 3. 数据库和返回处理
        if has_id:
            # 更新数据库中的分享链接
            update_result = update_share_link(share_id, new_share_url, new_file_id)

            if not update_result:
                logger.error(f"更新分享链接失败: {share_id}")
                return

            logger.info(f"成功更新分享链接: {share_id}")
            return
        else:
            # 从搜索路由调用，需要返回处理结果
            # 检查是否需要插入新记录
            if any(key in share_data for key in ['name', 'cloud_name', 'resource_type', 'remark']):
                original_record = {
                    'file_id': new_file_id,
                    'name': share_data.get('name', title),
                    'share_link': new_share_url,
                    'cloud_name': share_data.get('cloud_name', netdisk_type),  # 使用实际转存的网盘名称
                    'type': share_data.get('resource_type', None),
                    'remarks': share_data.get('remark', None)
                }
                new_id = insert_resource(original_record)
                if new_id:
                    logger.info(f"资源 {title} 已成功添加到数据库，ID: {new_id}")
                    return original_record
                else:
                    logger.error(f"资源 {title} 添加到数据库失败")
                    return None
            else:
                return {"share_url": new_share_url, "file_id": new_file_id}

    except Exception as e:
        logger.error(f"处理分享时发生错误: {e}")
        if 'id' not in share_data:
            return None
        return


def del_share(share_data):
    """
    删除分享链接对应的网盘文件 (支持夸克和百度网盘)
    """
    try:
        # 检查 share_data 是否包含必需的 share_link
        share_url = share_data.get('share_url')
        if not share_url:
            logger.error("分享链接 'share_url' 是必需的，但未提供。")
            return None

        # 1. 确定网盘类型、文件ID和客户端
        netdisk_type = match_netdisk_link(share_url)
        file_id = share_data.get('file_id')

        if netdisk_type == "夸克网盘":
            client_class = Quark
            client_cookie = QUARK_PAN_COOKIE
        elif netdisk_type == "百度网盘":
            client_class = Baidu
            client_cookie = BAIDU_PAN_COOKIE
        else:
            logger.warning(f"分享链接 {share_url} 不是支持的网盘链接，跳过处理。")
            return None

        if not file_id:
            logger.error(f"未找到分享链接 {share_url} 对应的 file_id，无法删除。")
            return None

        # 2. 执行删除文件操作
        status = _handle_netdisk_operation(
            client_class=client_class,
            client_cookie=client_cookie,
            share_url=share_url,
            operation='delete',
            file_id=file_id
        )

        # 3. 数据库处理
        if status:
            # 从数据库中删除记录
            delete_by_share_link(share_url)
            logger.info(f"成功删除分享及数据库记录，链接: {share_url}")
            return True
        else:
            logger.error(f"{netdisk_type} 网盘删除文件操作失败，链接: {share_url}")
            return False

    except Exception as e:
        logger.error(f"删除分享时出现错误，错误信息: {str(e)}")
        return None