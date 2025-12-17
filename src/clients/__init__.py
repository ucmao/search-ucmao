# 夸克网盘客户端包
from .quark_client import Quark
from src.db.resources_dao import insert_resource, query_file_id_by_share_link, delete_by_share_link, random_read_record
from .quark_client import ad_check
