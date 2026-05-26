"""
API Response Validation Test
Tests the Flask API response format and error handling
Run this after installing dependencies: python3 -m pip install --break-system-packages -r requirements.txt
"""

import sys
import os
import json
import unittest
from unittest.mock import patch, MagicMock
from io import StringIO


class TestAPIResponseFormat(unittest.TestCase):
    """Test API response format compatibility with Node.js backend"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.maxDiff = None
    
    def test_success_response_structure(self):
        """Test expected success response structure"""
        response = {
            "success": True,
            "analysis": {
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
            }
        }
        
        # Validate structure
        self.assertIsInstance(response, dict)
        self.assertIn('success', response)
        self.assertTrue(response['success'])
        self.assertIn('analysis', response)
        self.assertIsInstance(response['analysis'], dict)
    
    def test_error_response_structure(self):
        """Test expected error response structure"""
        response = {
            "success": False,
            "error": "Missing required field: text",
            "errorDetail": {
                "code": "MISSING_FIELD",
                "details": "The 'text' field is required"
            }
        }
        
        # Validate structure
        self.assertIsInstance(response, dict)
        self.assertIn('success', response)
        self.assertFalse(response['success'])
        self.assertIn('error', response)
        self.assertIsInstance(response['error'], str)
        
        # Verify errorDetail is NOT a function
        if 'errorDetail' in response:
            self.assertNotIsInstance(response['errorDetail'], type(lambda: None))
            # Should be dict or str
            self.assertIn(type(response['errorDetail']), [dict, str])
    
    def test_error_response_without_detail(self):
        """Test error response without errorDetail is valid"""
        response = {
            "success": False,
            "error": "Service unavailable"
        }
        
        # Should still be valid
        self.assertIsInstance(response, dict)
        self.assertFalse(response['success'])
        self.assertIn('error', response)
    
    def test_json_serializable(self):
        """Test responses are JSON serializable"""
        test_responses = [
            {
                "success": True,
                "analysis": {"ekman": {}}
            },
            {
                "success": False,
                "error": "Error message",
                "errorDetail": {"code": "ERROR_CODE"}
            },
            {
                "success": False,
                "error": "Error message"
            }
        ]
        
        for response in test_responses:
            try:
                json_str = json.dumps(response)
                parsed = json.loads(json_str)
                self.assertEqual(response, parsed)
            except Exception as e:
                self.fail(f"Response not JSON serializable: {e}")


class TestFlaskIntegration(unittest.TestCase):
    """Integration tests for Flask app (requires dependencies installed)"""
    
    def setUp(self):
        """Set up Flask test client"""
        try:
            # Try to import Flask app
            from main import app
            self.app = app
            self.app.config['TESTING'] = True
            self.client = self.app.test_client()
            self.app_available = True
        except ImportError as e:
            self.app_available = False
            self.skipTest(f"Flask not available: {e}")
    
    def test_analyze_endpoint_accessible(self):
        """Test /analyze endpoint is accessible"""
        if not self.app_available:
            self.skipTest("Flask app not available")
        
        response = self.client.post('/analyze', json={})
        # Should respond (not 404)
        self.assertNotEqual(response.status_code, 404)
    
    def test_analyze_response_is_json(self):
        """Test /analyze returns JSON"""
        if not self.app_available:
            self.skipTest("Flask app not available")
        
        response = self.client.post('/analyze', json={'text': 'test'})
        
        # Should be valid JSON
        try:
            data = response.get_json()
            self.assertIsNotNone(data)
        except Exception as e:
            self.fail(f"Response is not valid JSON: {e}")
    
    def test_analyze_error_response_format(self):
        """Test error response has correct format"""
        if not self.app_available:
            self.skipTest("Flask app not available")
        
        response = self.client.post('/analyze', json={})
        data = response.get_json()
        
        self.assertIsInstance(data, dict)
        self.assertIn('success', data)
        
        if not data.get('success'):
            # Error response must have 'error' field
            self.assertIn('error', data,
                         f"Error response missing 'error' field: {data}")
            # Ensure error is a string, not a function
            self.assertIsInstance(data['error'], str)


class TestNodeJSCompatibility(unittest.TestCase):
    """Test compatibility with Node.js backend expectations"""
    
    def test_no_function_fields(self):
        """Test that response fields are never functions"""
        sample_responses = [
            {"success": True, "analysis": {}},
            {"success": False, "error": "Test error"},
            {"success": False, "error": "Test", "errorDetail": {"code": "TEST"}}
        ]
        
        for response in sample_responses:
            for key, value in response.items():
                self.assertNotIsInstance(
                    value,
                    type(lambda: None),
                    f"Field '{key}' should not be a function: {response}"
                )
    
    def test_error_detail_structure(self):
        """Test errorDetail field if present is properly structured"""
        # Valid errorDetail formats
        valid_details = [
            None,  # Not present
            "error string",  # String
            {"code": "ERROR", "message": "details"},  # Object/dict
            {"error": "details"},  # Any dict
        ]
        
        for detail in valid_details:
            response = {
                "success": False,
                "error": "Error message"
            }
            if detail is not None:
                response["errorDetail"] = detail
            
            # Should be serializable
            json_str = json.dumps(response)
            parsed = json.loads(json_str)
            self.assertEqual(response, parsed)


class TestPerformanceExpectations(unittest.TestCase):
    """Test performance expectations for Node.js timeout (30s)"""
    
    def test_expected_timeout_value(self):
        """Document expected timeout values"""
        # Node.js backend has 30s timeout
        expected_timeout = 30000  # milliseconds
        
        # This test documents the constraint
        self.assertEqual(expected_timeout, 30000)
        
        print("\n[Performance Note]")
        print(f"Node.js backend timeout: {expected_timeout}ms ({expected_timeout/1000}s)")
        print("Python service must respond within this timeframe")
        print("\nOptimization recommendations:")
        print("1. Cache model loading on startup")
        print("2. Use async/background processing for long operations")
        print("3. Consider timeout configuration in saService.js")


if __name__ == '__main__':
    # Run tests with detailed output
    unittest.main(verbosity=2, exit=True)
