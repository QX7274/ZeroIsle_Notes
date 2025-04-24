from fastapi import APIRouter, HTTPException
import requests
import os
from typing import Optional

router = APIRouter()

# 配置
WECHAT_APP_ID = os.getenv("WECHAT_APP_ID")
WECHAT_APP_SECRET = os.getenv("WECHAT_APP_SECRET")
QQ_APP_ID = os.getenv("QQ_APP_ID")
QQ_APP_KEY = os.getenv("QQ_APP_KEY")

class ThirdPartyUser(BaseModel):
    openid: str
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    provider: str

async def get_wechat_access_token(code: str) -> str:
    url = "https://api.weixin.qq.com/sns/oauth2/access_token"
    params = {
        "appid": WECHAT_APP_ID,
        "secret": WECHAT_APP_SECRET,
        "code": code,
        "grant_type": "authorization_code"
    }
    response = requests.get(url, params=params)
    data = response.json()
    if "access_token" not in data:
        raise HTTPException(status_code=400, detail="Failed to get WeChat access token")
    return data["access_token"]

async def get_wechat_user_info(access_token: str, openid: str) -> dict:
    url = "https://api.weixin.qq.com/sns/userinfo"
    params = {
        "access_token": access_token,
        "openid": openid,
        "lang": "zh_CN"
    }
    response = requests.get(url, params=params)
    data = response.json()
    if "errcode" in data:
        raise HTTPException(status_code=400, detail="Failed to get WeChat user info")
    return data

async def get_qq_access_token(code: str) -> str:
    url = "https://graph.qq.com/oauth2.0/token"
    params = {
        "grant_type": "authorization_code",
        "client_id": QQ_APP_ID,
        "client_secret": QQ_APP_KEY,
        "code": code,
        "redirect_uri": "YOUR_REDIRECT_URI"
    }
    response = requests.get(url, params=params)
    data = response.text
    if "access_token" not in data:
        raise HTTPException(status_code=400, detail="Failed to get QQ access token")
    return data.split("=")[1].split("&")[0]

async def get_qq_openid(access_token: str) -> str:
    url = "https://graph.qq.com/oauth2.0/me"
    params = {"access_token": access_token}
    response = requests.get(url, params=params)
    data = response.text
    if "openid" not in data:
        raise HTTPException(status_code=400, detail="Failed to get QQ openid")
    return data.split('"openid":"')[1].split('"')[0]

async def get_qq_user_info(access_token: str, openid: str) -> dict:
    url = "https://graph.qq.com/user/get_user_info"
    params = {
        "access_token": access_token,
        "oauth_consumer_key": QQ_APP_ID,
        "openid": openid
    }
    response = requests.get(url, params=params)
    data = response.json()
    if data["ret"] != 0:
        raise HTTPException(status_code=400, detail="Failed to get QQ user info")
    return data

@router.post("/auth/login/wechat")
async def login_with_wechat(code: str):
    try:
        access_token = await get_wechat_access_token(code)
        user_info = await get_wechat_user_info(access_token, user_info["openid"])
        
        # 创建或更新用户
        user = ThirdPartyUser(
            openid=user_info["openid"],
            nickname=user_info.get("nickname"),
            avatar=user_info.get("headimgurl"),
            provider="wechat"
        )
        
        # 生成JWT token
        token = create_access_token({"sub": user.openid, "provider": "wechat"})
        
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "openid": user.openid,
                "nickname": user.nickname,
                "avatar": user.avatar,
                "provider": user.provider
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/auth/login/qq")
async def login_with_qq(code: str):
    try:
        access_token = await get_qq_access_token(code)
        openid = await get_qq_openid(access_token)
        user_info = await get_qq_user_info(access_token, openid)
        
        # 创建或更新用户
        user = ThirdPartyUser(
            openid=openid,
            nickname=user_info.get("nickname"),
            avatar=user_info.get("figureurl_qq_2"),
            provider="qq"
        )
        
        # 生成JWT token
        token = create_access_token({"sub": user.openid, "provider": "qq"})
        
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "openid": user.openid,
                "nickname": user.nickname,
                "avatar": user.avatar,
                "provider": user.provider
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) 