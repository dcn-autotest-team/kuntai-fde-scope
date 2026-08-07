import os
from pydantic_settings import BaseSettings

class Settings:
    PROJECT_NAME: str = "神州鲲泰 FDE 团队能力边界判定系统"
    API_PREFIX: str = "/api"
    
    # 数据库连接，默认使用 SQLite，生产环境可设置为 MySQL:
    # mysql+pymysql://user:password@localhost:3306/dbname?charset=utf8mb4
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./kuntai_fde.db")
    
    # 管理员登录密码哈希 (SHA-256)
    ADMIN_PWD_HASH: str = os.getenv("ADMIN_PWD_HASH", "c638bc74f30482cae5ec685f12c435196bca31a591b6943157e6f38c973ad467")
    TOKEN_TTL_HOURS: int = 2
    
    # 默认 AI 配置
    DEFAULT_ENDPOINT: str = "https://api.senseaudio.cn"
    DEFAULT_API_KEY: str = "sk-mlZowy8c4yiXCK6LxqSIyqRDsVDigXLJ705cCeEbBeAe40AaA07b05C4A7A28cB6"
    DEFAULT_MODEL: str = "senseaudio-s2-lite"

settings = Settings()
