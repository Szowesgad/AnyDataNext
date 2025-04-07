"""
LLM client interfaces for various providers.
"""

import os
import logging
from typing import List, Dict, Any, Optional
from .logging import setup_logging

logger = setup_logging()

try:
    import anthropic
except ImportError:
    logger.warning("Anthropic package not found. AnthropicClient will not work.")
    anthropic = None

try:
    from openai import OpenAI
except ImportError:
    logger.warning("OpenAI package not found. OpenAI-based clients will not work.")
    OpenAI = None


class LLMClient:
    """Base class for LLM clients."""
    
    def __init__(self, api_key=None):
        self.api_key = api_key
    
    async def generate(self, messages, **kwargs):
        """Generates a response based on messages."""
        raise NotImplementedError("Subclasses must implement generate()")


class AnthropicClient(LLMClient):
    """Client for Anthropic's Claude API."""
    
    def __init__(self, api_key=None):
        super().__init__(api_key or os.getenv("ANTHROPIC_API_KEY"))
        if anthropic is None:
            raise ImportError("Anthropic package is required for AnthropicClient")
        self.client = anthropic.Anthropic(api_key=self.api_key)
    
    async def generate(self, messages, model=None, max_tokens=None, temperature=None, system=None, **kwargs):
        """Generates a response using Claude API."""
        try:
            # Przygotuj parametry bez wartości None
            params = {"messages": messages}
            
            # Dodaj parametry tylko jeśli nie są None
            if model is not None:
                params["model"] = model
            if max_tokens is not None:
                params["max_tokens"] = max_tokens
            if temperature is not None:
                params["temperature"] = temperature
            
            # Dodaj system tylko jeśli nie jest None
            if system is not None:
                params["system"] = system
                
            # Dodaj pozostałe parametry z kwargs
            for key, value in kwargs.items():
                if value is not None:
                    params[key] = value
            
            # Wykonaj synchroniczne zapytanie do API, ale zwróć jako awaitable        
            response = self.client.messages.create(**params)
            return response.content[0].text
        except Exception as e:
            logger.error(f"Error with Anthropic API: {e}")
            return None


class OpenAIClient(LLMClient):
    """Client for OpenAI API."""
    
    def __init__(self, api_key=None, base_url=None):
        super().__init__(api_key or os.getenv("OPENAI_API_KEY"))
        if OpenAI is None:
            raise ImportError("OpenAI package is required for OpenAIClient")
        self.client = OpenAI(api_key=self.api_key, base_url=base_url)
    
    async def generate(self, messages, model=None, max_tokens=None, temperature=None, system=None, **kwargs):
        """Generates a response using OpenAI API."""
        try:
            # Obsługa parametru system - dodanie jako wiadomości z role="system"
            messages_copy = messages.copy()
            if system is not None:
                # Dodaj system message na początku listy wiadomości
                messages_copy.insert(0, {"role": "system", "content": system})
            
            params = {"messages": messages_copy}
            
            # Dodaj parametry tylko jeśli nie są None
            if model is not None:
                params["model"] = model
            if max_tokens is not None:
                params["max_tokens"] = max_tokens
            if temperature is not None:
                params["temperature"] = temperature
                
            # Dodaj pozostałe parametry z kwargs, pomijając 'system' który już obsłużyliśmy
            for key, value in kwargs.items():
                if value is not None and key != 'system':
                    params[key] = value
                    
            response = self.client.chat.completions.create(**params)
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error with OpenAI API: {e}")
            return None


class DeepSeekClient(OpenAIClient):
    """Client for DeepSeek API."""
    
    def __init__(self, api_key=None):
        api_key = api_key or os.getenv("DEEPSEEK_API_KEY")
        super().__init__(api_key=api_key, base_url="https://api.deepseek.com/v1")
    
    async def generate(self, messages, model=None, max_tokens=None, temperature=None, system=None, **kwargs):
        """Generates a response using DeepSeek API with specific limits."""
        # DeepSeek ma limit max_tokens = 8192
        if max_tokens is not None and max_tokens > 8192:
            logger.warning(f"DeepSeek API max_tokens limit is 8192, reducing from {max_tokens} to 8192")
            max_tokens = 8192
            
        return await super().generate(messages, model, max_tokens, temperature, system, **kwargs)


class QwenClient(OpenAIClient):
    """Client for Qwen API."""
    
    def __init__(self, api_key=None):
        api_key = api_key or os.getenv("QWEN_API_KEY")
        super().__init__(api_key=api_key, base_url="https://api.qwen.ai/v1")


class GoogleClient(LLMClient):
    """Client for Google API."""
    
    def __init__(self, api_key=None):
        super().__init__(api_key or os.getenv("GOOGLE_API_KEY"))
        # Placeholder for future Google API implementation
    
    async def generate(self, messages, model=None, max_tokens=None, temperature=None, **kwargs):
        """Generates a response using Google API."""
        try:
            # Placeholder for future Google API implementation
            logger.warning("Google API not yet implemented")
            return None
        except Exception as e:
            logger.error(f"Error with Google API: {e}")
            return None


class XAIClient(OpenAIClient):
    """Client for xAI API."""
    
    def __init__(self, api_key=None):
        api_key = api_key or os.getenv("XAI_API_KEY")
        super().__init__(api_key=api_key, base_url="https://api.xai.com/v1")


class OpenRouterClient(OpenAIClient):
    """Client for OpenRouter API."""
    
    def __init__(self, api_key=None):
        api_key = api_key or os.getenv("OPENROUTER_API_KEY")
        super().__init__(api_key=api_key, base_url="https://openrouter.ai/api/v1")


class GrokClient(OpenAIClient):
    """Client for Grok API."""
    
    def __init__(self, api_key=None):
        api_key = api_key or os.getenv("GROK_API_KEY")
        super().__init__(api_key=api_key, base_url="https://api.grok.ai/v1")


class MistralClient(OpenAIClient):
    """Client for Mistral API."""
    
    def __init__(self, api_key=None):
        api_key = api_key or os.getenv("MISTRAL_API_KEY")
        super().__init__(api_key=api_key, base_url="https://api.mistral.ai/v1")


class LMStudioClient(OpenAIClient):
    """Client for local LM Studio API."""
    
    def __init__(self, api_key=None, base_url=None):
        api_key = api_key or os.getenv("LM_STUDIO_API_KEY", "sk-dummy")
        base_url = base_url or os.getenv("LM_STUDIO_URL", "http://localhost:1234")
        super().__init__(api_key=api_key, base_url=f"{base_url}/v1")


# Factory for LLM clients
def get_llm_client(provider, api_key=None, base_url=None):
    """Factory function for LLM clients."""
    providers = {
        "anthropic": AnthropicClient,
        "claude": AnthropicClient,
        "openai": OpenAIClient,
        "deepseek": DeepSeekClient,
        "qwen": QwenClient,
        "google": GoogleClient,
        "xai": XAIClient,
        "openrouter": OpenRouterClient,
        "grok": GrokClient,
        "mistral": MistralClient,
        "lmstudio": LMStudioClient,
        "local": LMStudioClient,
    }
    
    if provider.lower() not in providers:
        logger.warning(f"Unknown provider: {provider}. Falling back to OpenAI.")
        provider = "openai"
    
    client_class = providers[provider.lower()]
    if provider.lower() in ["lmstudio", "local"]:
        return client_class(api_key=api_key, base_url=base_url)
    return client_class(api_key=api_key)