import requests
import re
import time
import json
import random
import logging
from typing import Tuple, List, Optional

logger = logging.getLogger(__name__)


class Baidu:
    """
    百度网盘客户端封装
    """

    def __init__(self, cookie: str) -> None:
        self.session = requests.Session()
        self.headers = {
            'Host': 'pan.baidu.com',
            'Connection': 'keep-alive',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
            'Referer': 'https://pan.baidu.com/disk/home',
            'Cookie': cookie
        }
        self.session.headers.update(self.headers)
        # 获取 bdstoken 用于后续操作（部分操作需要，部分不需要，预留）
        self.bdstoken = self._get_bdstoken()

    def store(self, share_url: str, to_dir: str = '/') -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """
        转存分享链接并重新分享
        :param share_url: 原始分享链接 (支持标准格式和带空格提取码格式)
        :param to_dir: 转存目标目录，默认为根目录
        :return: (文件路径, 文件名, 新分享链接)
        """
        try:
            # 1. 解析链接和提取码
            surl, pwd = self._parse_share_url(share_url)
            if not surl:
                logger.error(f"百度链接解析失败: {share_url}")
                return None, None, None

            # 2. 验证提取码 (如果有)
            if pwd:
                if not self._verify_pwd(surl, pwd):
                    logger.error(f"百度提取码验证失败: {surl} {pwd}")
                    return None, None, None

            # 3. 获取分享文件详情 (解析HTML)
            info = self._get_share_page_info(surl)
            if not info:
                logger.error("无法获取百度分享页面详情")
                return None, None, None

            shareid, from_uk, fs_id_list, file_names = info

            # 目前逻辑只处理单文件转存，取第一个
            target_fs_id = fs_id_list[0]
            file_name = file_names[0]

            # 4. 执行转存
            if not self._transfer_file(shareid, from_uk, [target_fs_id], to_dir):
                logger.error(f"转存文件失败: {file_name}")
                return None, None, None

            # 5. 获取转存后的新文件信息 (为了获取新的 fs_id 用于分享)
            # 百度转存后 fs_id 会变，且转存接口不直接返回新 fs_id，需要去目标目录查询
            full_path = f"{to_dir.rstrip('/')}/{file_name}" if to_dir != '/' else f"/{file_name}"
            new_fs_id = self._get_file_id_by_path(full_path)

            if not new_fs_id:
                logger.error(f"无法获取转存后的文件ID: {full_path}")
                # 尝试用原始路径返回，虽然可能导致后续分享失败，但文件已存
                return full_path, file_name, ""

            # 6. 创建新的分享链接
            new_share_link = self._create_share(new_fs_id)
            if not new_share_link:
                logger.error("创建新分享失败")
                return full_path, file_name, ""

            # 注意：这里返回 full_path 作为 file_id，因为百度的删除接口通常需要路径
            return full_path, file_name, new_share_link

        except Exception as e:
            logger.error(f"百度网盘 Store 操作异常: {e}")
            return None, None, None

    def del_file(self, file_path_list: List[str]) -> bool:
        """
        删除文件
        :param file_path_list: 文件路径列表 ["/我的资源/1.mp4"]
        """
        logger.info(f"正在删除百度网盘文件: {file_path_list}")
        url = "https://pan.baidu.com/api/filemanager"
        params = {
            # 使用您实测成功的参数
            "async": 2,
            "onnest": "fail",
            # 使用您实测成功的 opera 参数
            "opera": "delete",
            "bdstoken": self.bdstoken,
            # 新增实测 URL 中的参数
            "newVerify": 1,
            "clienttype": 0,
            "web": 1,
            "app_id": 250528,
            # 删除了 dp-logid，因为它通常是动态生成且非必需
        }

        # 修正 payload 格式：使用 json.dumps 确保路径中的特殊字符正确转义，
        # 并保持 ensure_ascii=False 以避免中文问题。
        payload = {"filelist": json.dumps(file_path_list, ensure_ascii=False)}

        try:
            # 百度删除接口通常需要 POST 表单数据
            res = self.session.post(url, params=params, data=payload)
            data = res.json()

            if data.get("errno") == 0:
                # errno 0 表示删除请求已成功提交，即使是异步任务也视为成功
                logger.info(f"文件删除请求提交成功 (Task ID: {data.get('taskid')})")
                return True
            # errno 2: 文件不存在，可能是重复删除，也可以视为成功
            elif data.get("errno") == 2:
                logger.warning(f"文件不存在 (errno: 2)，可能已被删除: {file_path_list}")
                return True
            else:
                logger.error(f"文件删除请求失败, errno: {data.get('errno')}, 错误详情: {data}")
                return False
        except Exception as e:
            logger.error(f"删除请求异常: {e}")
            return False

    # ================= 内部辅助方法 =================

    def _get_bdstoken(self) -> str:
        """简单的获取 bdstoken，如果失败返回空字符串，不影响大部分操作"""
        try:
            url = "https://pan.baidu.com/api/gettemplatevariable?fields=[%22bdstoken%22]"
            res = self.session.get(url)
            return res.json().get("result", {}).get("bdstoken", "")
        except:
            return ""

    def _parse_share_url(self, url: str) -> Tuple[str, str]:
        """解析链接，返回 (surl, pwd)"""
        # 提取 surl (1xxxxxx)
        m_surl = re.search(r's/1([a-zA-Z0-9-_]+)', url)
        if not m_surl:
            m_surl = re.search(r'surl=([a-zA-Z0-9-_]+)', url)  # 兼容 old format

        surl = m_surl.group(1) if m_surl else ""
        if not surl:
            # 尝试直接从完整链接截取
            if 'baidu.com/s/' in url:
                surl = url.split('baidu.com/s/')[-1].split(' ')[0]
                if surl.startswith('1'):
                    surl = surl[1:]  # 百度API通常只要 s/1 后面的部分

        # 提取提取码
        pwd = ""
        if 'pwd=' in url:
            pwd = url.split('pwd=')[-1].split('&')[0].strip()[:4]
        elif '提取码' in url:
            # 简单粗暴提取最后4位，或按空格分割
            parts = url.split(' ')
            for p in parts:
                if len(p.strip()) == 4 and p.isalnum():
                    pwd = p.strip()

        return surl, pwd

    def _verify_pwd(self, surl: str, pwd: str) -> bool:
        """验证提取码并设置 Cookie"""
        url = "https://pan.baidu.com/share/verify"
        params = {
            "surl": surl,
            "t": int(time.time() * 1000),
            "bdstoken": self.bdstoken,
            "channel": "chunlei",
            "clienttype": 0,
            "web": 1
        }
        data = {"pwd": pwd, "vcode": "", "vcode_str": ""}
        try:
            res = self.session.post(url, params=params, data=data)
            js = res.json()
            if js.get("errno") == 0:
                return True
            logger.warning(f"验证码错误: {js}")
            return False
        except Exception as e:
            logger.error(f"验证请求异常: {e}")
            return False

    def _get_share_page_info(self, surl: str) -> Optional[tuple]:
        """访问分享页 HTML 提取必要参数"""
        url = f"https://pan.baidu.com/s/1{surl}"
        try:
            res = self.session.get(url)
            html = res.text

            # 正则提取
            shareid = re.search(r'"shareid":(\d+),', html)
            uk = re.search(r'"share_uk":"?(\d+)"?,', html)
            fs_ids = re.findall(r'"fs_id":(\d+),', html)
            filenames = re.findall(r'"server_filename":"(.+?)",', html)

            if shareid and uk and fs_ids:
                # 去重 fs_ids 和 filenames
                fs_ids = list(dict.fromkeys(fs_ids))
                filenames = list(dict.fromkeys(filenames))
                return shareid.group(1), uk.group(1), fs_ids, filenames
            return None
        except Exception as e:
            logger.error(f"解析页面异常: {e}")
            return None

    def _transfer_file(self, shareid: str, from_uk: str, fs_id_list: list, to_path: str) -> bool:
        """转存文件"""
        url = "https://pan.baidu.com/share/transfer"
        params = {
            "shareid": shareid,
            "from": from_uk,
            "ondup": "newcopy",  # 遇到重名自动重命名
            "async": 1,
            "bdstoken": self.bdstoken,
            "channel": "chunlei",
            "clienttype": 0,
            "web": 1,
            "app_id": 250528
        }
        data = {
            "fsidlist": f"[{','.join(str(x) for x in fs_id_list)}]",
            "path": to_path
        }
        try:
            res = self.session.post(url, params=params, data=data)
            js = res.json()
            if js.get("errno") == 0:
                return True
            logger.error(f"转存API返回错误: {js}")
            return False
        except Exception as e:
            logger.error(f"转存请求异常: {e}")
            return False

    def _get_file_id_by_path(self, path: str) -> Optional[int]:
        """根据路径获取文件的 fs_id (用于转存后分享)"""
        # 获取父目录和文件名
        if path == '/': return None
        if path.endswith('/'): path = path[:-1]

        dir_path, filename = path.rsplit('/', 1)
        if not dir_path: dir_path = '/'

        url = "https://pan.baidu.com/api/list"
        params = {
            "dir": dir_path,
            "bdstoken": self.bdstoken,
            "clienttype": 0,
            "web": 1,
            "page": 1,
            "num": 1000,  # 假设文件在前1000个
            "order": "time",
            "desc": 1
        }
        try:
            res = self.session.get(url, params=params)
            js = res.json()
            if js.get("errno") != 0:
                return None

            file_list = js.get("list", [])
            for f in file_list:
                if f.get("server_filename") == filename:
                    return f.get("fs_id")
            return None
        except Exception as e:
            logger.error(f"查询文件ID异常: {e}")
            return None

    def _create_share(self, fs_id: int) -> Optional[str]:
        """创建分享链接"""
        url = "https://pan.baidu.com/share/set"
        params = {
            "bdstoken": self.bdstoken,
            "channel": "chunlei",
            "clienttype": 0,
            "web": 1,
            "app_id": 250528
        }
        data = {
            "fid_list": f"[{fs_id}]",
            "schannel": 4,
            "channel_list": "[]",
            "period": 0  # 0 为永久
        }

        # 生成4位随机提取码
        pwd = ''.join(random.sample('0123456789abcdefghijklmnopqrstuvwxyz', 4))
        data["pwd"] = pwd

        try:
            res = self.session.post(url, params=params, data=data)
            js = res.json()
            if js.get("errno") == 0:
                short_link = js.get("shorturl")
                # 组合成完整链接
                return f"{short_link}?pwd={pwd}"  # 或者返回 "link pwd" 格式，根据需求调整
            logger.error(f"创建分享失败: {js}")
            return None
        except Exception as e:
            logger.error(f"创建分享请求异常: {e}")
            return None