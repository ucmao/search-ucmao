import logging
from pathlib import Path
from logging.handlers import RotatingFileHandler

def setup_logging(log_file: str = "logs/search_ucmao.log", level=logging.INFO):
    log_path = Path(log_file)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            RotatingFileHandler(
                str(log_path),
                maxBytes=1024 * 1024,   # 1MB
                backupCount=5,
                encoding='utf-8'
            ),
            logging.StreamHandler()
        ],
        force=True  # 👈 Python 3.8+ 支持，确保配置总是生效
    )
