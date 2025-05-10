import re
from server import PromptServer

class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False

any_typ = AnyType("*")

"""
Send a message to the frontend.
"""
def send_request(topic, data):
    PromptServer.instance.send_sync(topic, data)

class LiebsTitleVar():
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "name": ("STRING",{"default":"var1"}),
                "value": (any_typ,),
            },
            "optional": {
                "regex": ("STRING",),
            },
            "hidden": {
                "title_tab_id": ("STRING",)
            }
        }

    RETURN_TYPES = ()
    FUNCTION = "func"
    CATEGORY = "notify"
    OUTPUT_NODE = True

    def IS_CHANGED(name, value, regex):
        return float("NaN")

    def match_vars(self, name, value, regex):
        try:
            names = name.split(",")
            match = re.search(regex, value)
            var_dict = {}
            if match is not None:            
                groups = match.groups()
                print("LiebsTitleVar: match_vars: matched")
                print("LiebsTitleVar: names", names)
                print("LiebsTitleVar: groups", groups)                
                for i in range(min(len(groups),len(name))):                
                    var_dict[names[i]] = groups[i]
            else:
                print("LiebsTitleVar: match_vars: no match")
                print("LiebsTitleVar: pattern", regex)
                print("LiebsTitleVar: value", value)

            return var_dict
        except re.error:
            raise ValueError("Invalid regular expression!")
        
    def func(self, name, value, regex, title_tab_id):
        if regex:
            var_dict = self.match_vars(name, value, regex)
        else:
            var_dict = {name: value}

        send_request("liebs-title-vars", {
            "title_tab_id": title_tab_id,
            "variables": var_dict
        })
        return ()
