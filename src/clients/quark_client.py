import requests
import re
import time
import random
import logging

logger = logging.getLogger(__name__)


def ad_check(file_name):
    """
    检查文件名是否包含广告关键词。

    参数:
    file_name (str): 文件名

    返回:
    bool: 如果文件名包含广告关键词，返回 True；否则返回 False
    """
    # 定义广告关键词列表
    ad_keywords = ['防迷路', '防失联']

    # 将文件名转换为小写，以便不区分大小写
    file_name_lower = file_name.lower()

    # 检查文件名是否包含任何广告关键词
    for keyword in ad_keywords:
        if keyword in file_name_lower:
            return True

    return False


def get_id_from_url(url) -> str:
    """pwd_id"""
    pattern = r"/s/(\w+)"
    match = re.search(pattern, url)
    if match:
        return match.group(1)
    return ""


def generate_timestamp(length):
    timestamps = str(time.time() * 1000)
    return int(timestamps[0:length])


class Quark:
    ad_pwd_id = "0df525db2bd0"

    def __init__(self, cookie: str) -> None:
        self.headers = {
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'accept': 'application/json, text/plain, */*',
            'content-type': 'application/json; charset=utf-8',
            'sec-ch-ua-mobile': '?0',
            'user-agent': 'Mozilla/5.0 (Linux; Android 10; Pixel 4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
            'sec-ch-ua-platform': '"Windows"',
            'origin': 'https://pan.quark.cn',
            'sec-fetch-site': 'same-site',
            'sec-fetch-mode': 'cors',
            'sec-fetch-dest': 'empty',
            'referer': 'https://pan.quark.cn/',
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'zh-CN,zh;q=0.9',
            'cookie': cookie}

    def store(self, url: str, to_pdir_fid: str = '0'):  # 添加 to_pdir_fid 参数，默认值为 "0"
        pwd_id = get_id_from_url(url)
        stoken = self.get_stoken(pwd_id)

        if not stoken:
            logger.error(f"获取stoken失败: {pwd_id}")
            return None, None, None

        detail = self.detail(pwd_id, stoken)

        if not detail:
            logger.error(f"获取分享详情失败: {pwd_id}")
            return None, None, None

        file_name = detail.get('title')
        first_id = detail.get("fid")
        share_fid_token = detail.get("share_fid_token")
        file_type = detail.get("file_type")

        if not all([first_id, share_fid_token]):
            logger.error(f"分享详情缺少必要信息: fid={first_id}, share_fid_token={share_fid_token}")
            return None, None, None

        task = self.save_task_id(pwd_id, stoken, first_id, share_fid_token, to_pdir_fid)  # 传递 to_pdir_fid 参数

        if not task:
            logger.error("创建保存任务失败")
            return None, None, None

        data = self.task(task)

        if not data or not data.get("data"):
            logger.error("获取保存任务结果失败")
            return None, None, None

        save_as_data = data.get("data").get("save_as", {})
        save_as_top_fids = save_as_data.get("save_as_top_fids", [])

        if not save_as_top_fids:
            logger.error("保存结果中没有找到文件ID")
            return None, None, None

        file_id = save_as_top_fids[0]

        # if not file_type:
        #     dir_file_list = self.get_dir_file(file_id)
        #     self.del_ad_file(dir_file_list)
        #     self.add_ad(file_id)

        share_task_id = self.share_task_id(file_id, file_name)

        if not share_task_id:
            logger.error("创建分享任务失败")
            return None, None, None

        share_task_result = self.task(share_task_id)

        if not share_task_result or not share_task_result.get("data"):
            logger.error("获取分享任务结果失败")
            return None, None, None

        share_id = share_task_result.get("data").get("share_id")

        if not share_id:
            logger.error("分享结果中没有找到分享ID")
            return None, None, None

        share_link = self.get_share_link(share_id)

        if not share_link:
            logger.error("获取分享链接失败")
            return None, None, None

        return file_id, file_name, share_link

    def get_stoken(self, pwd_id: str):
        url = f"https://drive-pc.quark.cn/1/clouddrive/share/sharepage/token?pr=ucpro&fr=pc&uc_param_str=&__dt=405&__t={generate_timestamp(13)}"
        payload = {"pwd_id": pwd_id, "passcode": ""}
        headers = self.headers
        response = requests.post(url, json=payload, headers=headers).json()
        if response.get("data"):
            return response["data"]["stoken"]
        else:
            return ""

    def detail(self, pwd_id, stoken):
        url = f"https://drive-pc.quark.cn/1/clouddrive/share/sharepage/detail"
        headers = self.headers
        params = {
            "pwd_id": pwd_id,
            "stoken": stoken,
            "pdir_fid": 0,
            "_page": 1,
            "_size": "50",
        }
        response = requests.request("GET", url=url, headers=headers, params=params)
        response_data = response.json().get("data", {})
        file_list = response_data.get("list", [])

        if not file_list:
            logger.error(f"获取分享详情失败，列表为空: {pwd_id}")
            return {}

        id_list = file_list[0]
        if id_list:
            data = {
                "title": id_list.get("file_name"),
                "file_type": id_list.get("file_type"),
                "fid": id_list.get("fid"),
                "pdir_fid": id_list.get("pdir_fid"),
                "share_fid_token": id_list.get("share_fid_token")
            }
            return data
        return {}

    def save_task_id(self, pwd_id, stoken, first_id, share_fid_token, to_pdir_fid: str = '0'):
        logger.info("获取保存文件的TASKID")
        url = "https://drive.quark.cn/1/clouddrive/share/sharepage/save"
        params = {
            "pr": "ucpro",
            "fr": "pc",
            "uc_param_str": "",
            "__dt": int(random.uniform(1, 5) * 60 * 1000),
            "__t": generate_timestamp(13),
        }
        data = {"fid_list": [first_id],
                "fid_token_list": [share_fid_token],
                "to_pdir_fid": to_pdir_fid, "pwd_id": pwd_id,
                "stoken": stoken, "pdir_fid": "0", "scene": "link"}
        response = requests.request("POST", url, json=data, headers=self.headers, params=params)
        task_id = response.json().get('data').get('task_id')
        return task_id

    def task(self, task_id, trice=10):
        """根据task_id进行任务"""
        logger.info("根据TASKID执行任务")
        trys = 0
        for i in range(trice):
            url = f"https://drive-pc.quark.cn/1/clouddrive/task?pr=ucpro&fr=pc&uc_param_str=&task_id={task_id}&retry_index={i}&__dt=21192&__t={generate_timestamp(13)}"
            trys += 1
            try:
                response = requests.get(url, headers=self.headers).json()
                if response and response.get('data') and response.get('data').get('status'):
                    return response
            except Exception as e:
                logger.error(f"执行任务时发生异常: {e}")
        logger.warning(f"任务执行失败或超时: {task_id}")
        return None

    def share_task_id(self, file_id, file_name):
        """创建分享任务ID"""
        url = "https://drive-pc.quark.cn/1/clouddrive/share?pr=ucpro&fr=pc&uc_param_str="
        data = {"fid_list": [file_id],
                "title": file_name,
                "url_type": 1, "expired_type": 1}
        response = requests.request("POST", url=url, json=data, headers=self.headers)
        return response.json().get("data").get("task_id")

    def get_share_link(self, share_id):
        url = "https://drive-pc.quark.cn/1/clouddrive/share/password?pr=ucpro&fr=pc&uc_param_str="
        data = {"share_id": share_id}
        response = requests.post(url=url, json=data, headers=self.headers)
        return response.json().get("data").get("share_url")

    def get_all_file(self) -> list:
        logger.info("正在获取所有文件")
        url = "https://drive-pc.quark.cn/1/clouddrive/file/sort?pr=ucpro&fr=pc&uc_param_str="
        params = {
            "pdir_fid": 0,
            "_page": 1,
            "_size": 50,
            "_fetch_total": 1,
            "_fetch_sub_dirs": 0,
            "_sort": "file_type:asc,updated_at:desc"
        }
        response = requests.get(url=url, headers=self.headers, params=params)
        return response.json().get('data').get('list')

    def get_dir_file(self, dir_id, page: int = 1, size: int = 100) -> list:
        logger.info("正在遍历父文件夹")
        """获取指定文件夹的文件,后期可能会递归"""
        url = f"https://drive-pc.quark.cn/1/clouddrive/file/sort?pr=ucpro&fr=pc&uc_param_str="
        params = {
            "pdir_fid": dir_id,
            "_page": page,
            "_size": size,
            "_fetch_total": 1,
            "_fetch_sub_dirs": 0,
            "_sort": "file_type:asc,updated_at:desc"
        }
        response = requests.get(url=url, headers=self.headers, params=params)
        files_list = response.json().get('data').get('list')
        return files_list

    def create_dir(self, dir_name: str, parent_dir_id: str = "0"):
        logger.info(f"创建新目录: {dir_name}")
        url = "https://drive-pc.quark.cn/1/clouddrive/file?pr=ucpro&fr=pc&uc_param_str="
        data = {
            "pdir_fid": parent_dir_id,
            "file_name": dir_name,
            "dir_path": "",
            "dir_init_lock": False
        }
        response = requests.post(url, json=data, headers=self.headers)
        return response.json()

    def rename_dir(self, dir_id: str, new_name: str):
        logger.info(f"重命名目录: {dir_id} 为 {new_name}")
        url = "https://drive-pc.quark.cn/1/clouddrive/file/rename?pr=ucpro&fr=pc&uc_param_str="
        data = {"fid": dir_id, "file_name": new_name}
        response = requests.post(url, json=data, headers=self.headers)
        return response.json()

    def move_file(self, file_fid: str, to_pdir_fid: str):
        logger.info(f"移动文件: {file_fid} 到 {to_pdir_fid}")
        url = "https://drive-pc.quark.cn/1/clouddrive/file/move?pr=ucpro&fr=pc&uc_param_str="
        data = {
            "action_type": 1,
            "exclude_fids": [],
            "filelist": [file_fid],
            "to_pdir_fid": to_pdir_fid
        }
        response = requests.post(url, json=data, headers=self.headers)
        return response.json()

    def del_file(self, file_id):
        logger.info("正在删除文件")
        url = "https://drive-pc.quark.cn/1/clouddrive/file/delete?pr=ucpro&fr=pc&uc_param_str="
        data = {"action_type": 2, "filelist": [file_id], "exclude_fids": []}
        response = requests.post(url=url, json=data, headers=self.headers)
        if response.status_code == 200:
            return response.json().get("data").get("task_id")
        return False

    def del_ad_file(self, file_list):
        logger.info("删除可能存在广告的文件")
        for file in file_list:
            file_name = file.get("file_name")
            if ad_check(file_name):
                task_id = self.del_file(file.get("fid"))
                self.task(task_id)

    def add_ad(self, dir_id):
        logger.info("添加个人自定义广告")
        pwd_id = self.ad_pwd_id
        stoken = self.get_stoken(pwd_id)
        detail = self.detail(pwd_id, stoken)
        first_id, share_fid_token = detail.get("fid"), detail.get("share_fid_token")
        task_id = self.save_task_id(pwd_id, stoken, first_id, share_fid_token, dir_id)
        self.task(task_id, 1)
        logger.info("广告移植成功")

    def search_file(self, file_name):
        logger.info("正在从网盘搜索文件🔍")
        url = "https://drive-pc.quark.cn/1/clouddrive/file/search?pr=ucpro&fr=pc&uc_param_str=&_page=1&_size=50&_fetch_total=1&_sort=file_type:desc,updated_at:desc&_is_hl=1"
        params = {"q": file_name}
        response = requests.get(url=url, headers=self.headers, params=params)
        return response.json().get('data').get('list')


if __name__ == '__main__':
    pass