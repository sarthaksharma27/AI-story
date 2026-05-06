from pydantic import BaseModel

class StoryRequest(BaseModel):
    idea: str