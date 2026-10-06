import os
from itertools import count

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI()


class Todo(BaseModel):
    id: int
    text: str
    done: bool = False


class TodoCreate(BaseModel):
    text: str


class TodoUpdate(BaseModel):
    done: bool


todos: list[Todo] = []
_next_id = count(1)


@app.get("/api/todos")
def list_todos():
    return todos


@app.post("/api/todos")
def create_todo(payload: TodoCreate):
    todo = Todo(id=next(_next_id), text=payload.text)
    todos.append(todo)
    return todo


@app.patch("/api/todos/{todo_id}")
def update_todo(todo_id: int, payload: TodoUpdate):
    for t in todos:
        if t.id == todo_id:
            t.done = payload.done
            return t
    raise HTTPException(status_code=404, detail="Todo not found")


@app.delete("/api/todos/{todo_id}")
def delete_todo(todo_id: int):
    global todos
    todos = [t for t in todos if t.id != todo_id]
    return {"ok": True}


BASE_DIR = os.path.dirname(__file__)
STATIC_DIR = os.path.join(BASE_DIR, "static")


@app.get("/")
def landing():
    return FileResponse(os.path.join(BASE_DIR, "landing.html"))


if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/app")
    @app.get("/app/{full_path:path}")
    def todo_app(full_path: str = ""):
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))
