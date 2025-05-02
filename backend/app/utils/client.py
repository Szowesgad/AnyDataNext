"""
LLM client interfaces for various providers.

Implements unified interface for multiple LLM providers including:
- OpenAI-compatible APIs (OpenAI, Mistral, DeepSeek, etc)
- Anthropic Claude API
- Custom LibraxisAI API with dynamic model loading from /v1/models

Design supports robust error handling, rate limiting, and dynamic model fetching.
"""

import os
import logging
import time
import random
import asyncio
import json
import httpx
from typing import List, Dict, Any, Optional, Union, Callable
from .logging import setup_logging

logger = setup_logging()

# Import dependencies with error handling
try:
    import anthropic
except ImportError:
    logger.warning("Anthropic package not found. AnthropicClient will not work.")
    anthropic = None

try:
    from openai import OpenAI, RateLimitError, APIError, APIConnectionError
except ImportError:
    logger.warning("OpenAI package not found. OpenAI-based clients will not work.")
    OpenAI = None
    # Define error classes for consistent handling if OpenAI is not available
    class RateLimitError(Exception): pass
    class APIError(Exception): pass
    class APIConnectionError(Exception): pass


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


class LibraxisAIClient(OpenAIClient):
    """Client for LibraxisAI API with dynamic model fetching."""
    
    def __init__(self, api_key=None, base_url=None):
        """Initialize LibraxisAI client with API key and dynamic model endpoint."""
        api_key = api_key or os.getenv("LIBRAXIS_API_KEY")
        # Default to localhost for development, otherwise use libraxis.cloud
        base_url = base_url or os.getenv("LIBRAXIS_API_URL", "https://libraxis.cloud/v1")
        
        # Initialize with OpenAI compatibility
        super().__init__(api_key=api_key, base_url=base_url)
        
        # Track rate limit state
        self.retry_after = 0  # Seconds to wait before next request
        self.max_retries = 5  # Maximum number of retries
        self.models_cache = {}  # Cache for available models
        self.models_cache_expiry = 0  # Cache expiry timestamp
        self.models_cache_ttl = 300  # Cache TTL in seconds (5 minutes)
        
    async def list_models(self, force_refresh=False):
        """Fetch available models from /v1/models endpoint."""
        # Return cached models if available and not expired
        current_time = time.time()
        if (not force_refresh and 
            self.models_cache and 
            current_time < self.models_cache_expiry):
            logger.debug("Using cached models list")
            return self.models_cache
        
        try:
            async with httpx.AsyncClient() as client:
                url = f"{self.client.base_url}/models"
                logger.info(f"Fetching models from {url}")
                
                response = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=10.0
                )
                response.raise_for_status()
                
                data = response.json()
                models_data = data.get('data', [])
                
                # Format and cache model data
                self.models_cache = {
                    model.get('id'): {
                        'id': model.get('id'),
                        'created': model.get('created'),
                        'owned_by': model.get('owned_by', 'libraxis'),
                        'capabilities': model.get('capabilities', {}),
                        'limits': model.get('limits', {})
                    } for model in models_data if model.get('id')
                }
                
                # Update cache expiry
                self.models_cache_expiry = current_time + self.models_cache_ttl
                
                logger.info(f"Successfully fetched {len(self.models_cache)} models")
                return self.models_cache
                
        except Exception as e:
            logger.error(f"Error fetching models from LibraxisAI API: {e}")
            # Return empty cache on error but don't update expiry
            # so next request will try again
            return {}
    
    async def generate(self, messages, model=None, max_tokens=None, temperature=None, system=None, **kwargs):
        """Generate response with robust error handling and retries."""
        retries = 0
        backoff_factor = 1.5  # Exponential backoff multiplier
        
        # Dynamic model validation and fallback
        if model and not self.models_cache:
            # First fetch of models if empty
            try:
                await self.list_models()
            except:
                logger.warning("Failed to fetch models for validation")
        
        while retries <= self.max_retries:
            # Check if we need to wait due to rate limiting
            if self.retry_after > 0:
                wait_time = self.retry_after + random.uniform(0, 1)  # Add jitter
                logger.info(f"Rate limited. Waiting {wait_time:.2f}s before retry")
                await asyncio.sleep(wait_time)
                self.retry_after = 0  # Reset after waiting
            
            try:
                result = await super().generate(messages, model, max_tokens, temperature, system, **kwargs)
                return result
                
            except RateLimitError as e:
                retry_after = getattr(e, 'retry_after', 5)  # Get retry_after from exception if available
                self.retry_after = retry_after
                
                if retries >= self.max_retries:
                    logger.error(f"Maximum retries reached for rate limit ({retries})")
                    raise
                    
                retries += 1
                logger.warning(f"Rate limit error, retrying in {retry_after}s (attempt {retries}/{self.max_retries})")
                # Wait handled at start of next loop
                
            except (APIError, APIConnectionError) as e:
                if retries >= self.max_retries:
                    logger.error(f"Maximum retries reached for API error ({retries})")
                    raise
                    
                retries += 1
                wait_time = (backoff_factor ** retries) * 2  # Exponential backoff
                logger.warning(f"API error: {e}, retrying in {wait_time:.2f}s (attempt {retries}/{self.max_retries})")
                await asyncio.sleep(wait_time)
                
            except Exception as e:
                # Do not retry on other errors
                logger.error(f"Error with LibraxisAI API: {e}")
                raise
        
        # Should never reach here due to raise in loop
        logger.error("Unexpected error in LibraxisAI client")
        return None


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
        "libraxis": LibraxisAIClient,  # Add the new LibraxisAI client
    }
    
    if provider.lower() not in providers:
        logger.warning(f"Unknown provider: {provider}. Falling back to OpenAI.")
        provider = "openai"
    
    client_class = providers[provider.lower()]
    if provider.lower() in ["lmstudio", "local"]:
        return client_class(api_key=api_key, base_url=base_url)
    elif provider.lower() in ["libraxis"]:
        return client_class(api_key=api_key, base_url=base_url)
    return client_class(api_key=api_key)


# Utility function to get an ordered list of available models
async def get_available_models_for_provider(provider, api_key=None, base_url=None):
    """Returns ordered list of available models for a specific provider."""
    client = get_llm_client(provider, api_key, base_url)
    
    # Special handling for LibraxisAI client that has list_models method
    if provider.lower() == "libraxis" and hasattr(client, 'list_models'):
        models_dict = await client.list_models()
        return list(models_dict.keys()) if models_dict else []
    
    # For other clients, we could implement dynamic fetching per provider
    # For now, return None to indicate models should be fetched elsewhere
    return None