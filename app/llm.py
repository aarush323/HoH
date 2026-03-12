from dotenv import load_dotenv
import hashlib
import json
import re
import os

load_dotenv()


def get_llm(temperature: float= 0):

    from langchain_cerebras import ChatCerebras
    #from langchain_ollama import ChatOllama
    from langchain_groq import ChatGroq
    temp = temperature
    cerebras_key = os.getenv("CEREBRAS_API_KEY")
    groq_key = os.getenv("GROQ_API_KEY")

    USE_OLLAMA = True


   
    try:
        if groq_key:
            llm = ChatGroq(model="llama-3.1-8b-instant", api_key=groq_key, temperature=temperature)
            print("llm succex")
            return llm
    except Exception:
            pass

    try:
        if cerebras_key:
            llm = ChatCerebras(model = "gpt-oss-120b", api_key = cerebras_key, temperature = temp)
            print("llm: cerebras fallback")
            return llm
    except Exception:
            pass


    

   