from .liebs_title_var import LiebsTitleVar

NODE_CLASS_MAPPINGS = {
    'LiebsTitleVar': LiebsTitleVar
}

NODE_DISPLAY_NAME_MAPPINGS = {
    'LiebsTitleVar': 'Set Tab Title Variable'
}

WEB_DIRECTORY = "./js"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]