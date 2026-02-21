"""
U Funny API - Backend for the AI Comedy Coach
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ai_coach import get_coach_response, analyze_bit

app = FastAPI(
    title="U Funny API",
    description="AI Comedy Coach powered by Claude",
    version="1.0.0"
)

# CORS for React Native
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = []
    user_message: str


class ChatResponse(BaseModel):
    response: str


class AnalyzeBitRequest(BaseModel):
    bit_text: str
    context: str = ""


class AnalyzeBitResponse(BaseModel):
    analysis: str
    bit: str


@app.get("/")
def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "U Funny AI Coach"}


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    """
    Send a message to the AI comedy coach and get a response.
    Maintains conversation history for context.
    """
    try:
        # Convert Pydantic models to dicts for the AI module
        messages = [{"role": m.role, "content": m.content} for m in request.messages]
        
        response = get_coach_response(messages, request.user_message)
        return ChatResponse(response=response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze", response_model=AnalyzeBitResponse)
def analyze(request: AnalyzeBitRequest):
    """
    Analyze a comedy bit and get structured feedback.
    """
    try:
        result = analyze_bit(request.bit_text, request.context)
        return AnalyzeBitResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
