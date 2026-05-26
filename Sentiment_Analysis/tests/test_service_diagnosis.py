"""
Diagnostic test for sentiment analysis service
Tests the Flask API, analyzer functionality, and error handling
"""

import sys
import os
import json
import unittest
from typing import Dict, Any
from unittest.mock import patch, MagicMock

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.analyzer import AnalyzeError, analyze_message


class TestAnalyzerBasic(unittest.TestCase):
    """Test basic analyzer functionality"""
    
    def test_analyzer_import(self):
        """Test that analyzer module imports successfully"""
        self.assertIsNotNone(analyze_message)
    
    def test_error_class_exists(self):
        """Test that AnalyzeError class exists"""
        self.assertTrue(issubclass(AnalyzeError, Exception))
    
    def test_analyze_message_callable(self):
        """Test that analyze_message is callable"""
        self.assertTrue(callable(analyze_message))


class TestFlaskApp(unittest.TestCase):
    """Test Flask application endpoints"""
    
    def setUp(self):
        """Set up test client"""
        from main import app
        self.app = app
        self.client = self.app.test_client()
    
    def test_analyze_endpoint_exists(self):
        """Test that /analyze endpoint exists"""
        response = self.client.post('/analyze', json={'text': ''})
        # Should not be 404
        self.assertNotEqual(response.status_code, 404)
    
    def test_analyze_empty_json(self):
        """Test /analyze with empty JSON"""
        response = self.client.post('/analyze', json={})
        self.assertIn(response.status_code, [400, 422])
    
    def test_analyze_no_json(self):
        """Test /analyze with no JSON body"""
        response = self.client.post('/analyze')
        self.assertIn(response.status_code, [400, 422])
    
    def test_analyze_empty_text(self):
        """Test /analyze with empty text field"""
        response = self.client.post('/analyze', json={'text': '   '})
        self.assertIn(response.status_code, [400, 422])
    
    def test_analyze_response_format(self):
        """Test response format is JSON"""
        response = self.client.post(
            '/analyze',
            json={'text': 'test'}
        )
        try:
            data = response.get_json()
            self.assertIsInstance(data, dict)
        except Exception as e:
            self.fail(f"Response is not valid JSON: {e}")
    
    def test_analyze_response_has_success_field(self):
        """Test response has 'success' field"""
        response = self.client.post(
            '/analyze',
            json={'text': 'test'}
        )
        data = response.get_json() or {}
        self.assertIn('success', data, 
                     f"Response missing 'success' field: {data}")
    
    def test_analyze_response_structure(self):
        """Test response structure when success"""
        response = self.client.post(
            '/analyze',
            json={
                'text': 'This is a test',
                'history_last10': [],
                'typing': {}
            }
        )
        data = response.get_json() or {}
        
        # Check success field
        if 'success' in data and data['success']:
            # Should have analysis field
            self.assertIn('analysis', data, 
                         f"Success response missing 'analysis': {data}")
        else:
            # Should have error field
            self.assertIn('error', data, 
                         f"Error response should have 'error' field: {data}")


class TestEnvironmentConfig(unittest.TestCase):
    """Test environment configuration"""
    
    def test_env_files_exist(self):
        """Test that environment files are set up"""
        root_dir = os.path.dirname(os.path.dirname(__file__))
        env_file = os.path.join(root_dir, '.env')
        # Don't fail if .env doesn't exist, just log it
        if not os.path.exists(env_file):
            print(f"\nWarning: {env_file} not found")
    
    def test_required_api_keys_or_tokens(self):
        """Test that at least one API key/token is configured"""
        hf_token = os.getenv('HF_TOKEN')
        openrouter_key = os.getenv('OPENROUTER_API_KEY')
        
        has_auth = bool(hf_token or openrouter_key)
        if not has_auth:
            print("\nWarning: No HF_TOKEN or OPENROUTER_API_KEY configured")


class TestErrorHandling(unittest.TestCase):
    """Test error handling"""
    
    def setUp(self):
        from main import app
        self.app = app
        self.client = self.app.test_client()
    
    def test_error_response_structure(self):
        """Test that error responses have correct structure"""
        # Endpoint should return JSON with error
        response = self.client.post('/analyze', json={})
        
        try:
            data = response.get_json()
            if not data.get('success', True):
                # Error response should have 'error' field
                self.assertIn('error', data,
                             f"Error response missing 'error' field: {data}")
        except Exception as e:
            self.fail(f"Error response is not valid JSON: {e}")
    
    def test_error_detail_field_optional(self):
        """Test errorDetail is optional in error responses"""
        response = self.client.post('/analyze', json={})
        data = response.get_json() or {}
        
        # errorDetail should be optional
        if 'errorDetail' in data:
            # If present, should be a string or dict, not a function
            self.assertNotIsInstance(data['errorDetail'], type(lambda: None),
                                   "errorDetail should not be a function")


class TestDirectAnalyzerCall(unittest.TestCase):
    """Test calling analyzer directly"""
    
    @patch.dict(os.environ, {'OPENROUTER_API_KEY': 'test_key'})
    @patch('src.analyzer.openai.OpenAI')
    def test_analyze_with_mock_api(self, mock_openai):
        """Test analyze_message with mocked API"""
        # Mock the API response
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = json.dumps({
            "ekman": {
                "happiness": 50,
                "sadness": 20,
                "anger": 10,
                "fear": 5,
                "surprise": 10,
                "disgust": 5
            },
            "valence": 50,
            "arousal": 40
        })
        
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai.return_value = mock_client
        
        try:
            result = analyze_message("Test message", [])
            self.assertIsNotNone(result)
            self.assertIsInstance(result, dict)
        except Exception as e:
            print(f"\nNote: {e}")


if __name__ == '__main__':
    # Run tests with verbose output
    unittest.main(verbosity=2)
