import logging
from contextlib import contextmanager
from typing import Generator, Optional

import mysql.connector
from mysql.connector import MySQLConnection

from configs.app_config import db_config

logger = logging.getLogger(__name__)


def get_db_connection() -> Optional[MySQLConnection]:
    """
    获取数据库连接的统一入口。
    所有直接使用 mysql.connector.connect 的地方应改为调用此函数。
    """
    try:
        return mysql.connector.connect(**db_config)
    except mysql.connector.Error as err:
        logger.error(f"数据库连接失败: {err}")
        return None


@contextmanager
def db_cursor(dictionary: bool = False):
    """
    提供一个上下文管理器，统一管理连接与游标生命周期。
    使用示例：

        with db_cursor(dictionary=True) as cursor:
            cursor.execute("SELECT ...")
            rows = cursor.fetchall()
    """
    conn = get_db_connection()
    if not conn:
        yield None
        return

    cursor = conn.cursor(dictionary=dictionary)
    try:
        yield cursor
        conn.commit()
    except Exception as err:
        logger.error(f"数据库操作出错: {err}")
        conn.rollback()
        raise
    finally:
        try:
            cursor.close()
        finally:
            if conn.is_connected():
                conn.close()


