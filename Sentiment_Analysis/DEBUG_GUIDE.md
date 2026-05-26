# Sentiment Analysis Service - Debugging Guide

## Issues from Node.js Logs

### 1. ❌ `response.errorDetail is not a function`
**Problem**: The errorDetail field is being treated as a function when it should be a string or object.

**Root Cause**: Python service response has incorrect structure for errorDetail.

**Solution**:
- Check `saService.js` - verify how errorDetail is being used
- Ensure Python API returns errorDetail as a string or object, NOT a function
- Correct response format:
  ```json
  {
    "success": false,
    "error": "Error message",
    "errorDetail": "Additional details"
  }
  ```
  OR
  ```json
  {
    "success": false,
    "error": "Error message",
    "errorDetail": {"code": "ERROR_CODE", "message": "details"}
  }
  ```

### 2. ❌ `Python Sentiment Service Unavailable`
**Problem**: Node.js backend cannot reach or get response from Python service.

**Causes**:
1. **Python service not running**
   - Start Flask: `cd /home/prometheus/project/Sentiment_Analysis && python3 main.py`
   - Check if port is accessible (default 5000)

2. **Missing API Credentials**
   - Set environment variables:
     ```bash
     export OPENROUTER_API_KEY="your_key_here"
     # OR
     export HF_TOKEN="your_token_here"
     ```
   - Verify: `echo $OPENROUTER_API_KEY` or `echo $HF_TOKEN`

3. **Missing Python Dependencies**
   - Install: `python3 -m pip install --break-system-packages -r requirements.txt`
   - Verify installation: `python3 -c "import openai; print('OK')"`

4. **Flask Service Crashed**
   - Check logs: `tail -f /path/to/flask.log`
   - Run tests: `python3 tests/test_diagnose.py`

5. **Network Connectivity**
   - Python service must be accessible from Node.js backend
   - Check URL configuration in `saService.js`
   - Test endpoint: `curl http://localhost:5000/analyze -X POST -H "Content-Type: application/json" -d '{"text":"test"}'`

### 3. ❌ `NVIDIA Gemma 失敗: timeout of 30000ms exceeded`
**Problem**: API calls exceed 30-second timeout.

**Causes**:
1. **Slow API Response**
   - HuggingFace/OpenRouter API is slow
   - First request may be slow due to model loading

2. **Network Latency**
   - Check network connectivity to HuggingFace/OpenRouter
   - Test: `ping router.huggingface.co` (for HF)

3. **Large Input Text**
   - Very long input texts take longer to process
   - Consider text chunking

**Solutions**:
1. **Increase Timeout** (in `saService.js`):
   ```javascript
   const timeout = 45000; // 45 seconds instead of 30
   ```

2. **Optimize Python Service**:
   - Cache loaded models
   - Use faster model variants
   - Pre-warm the service on startup

3. **Add Retry Logic**:
   ```javascript
   // In saService.js
   const maxRetries = 3;
   const retryDelay = 2000; // 2 seconds between retries
   ```

## Testing Steps

### Quick Diagnostic
```bash
cd /home/prometheus/project/Sentiment_Analysis
python3 tests/test_diagnose.py
```
This will check:
- ✓ Project file structure
- ✓ Environment configuration
- ✓ Dependency installation
- ✓ Python syntax

### API Integration Test (after installing dependencies)
```bash
python3 tests/test_api_integration.py -v
```

### Manual API Testing
```bash
# Start Python service
cd /home/prometheus/project/Sentiment_Analysis
python3 main.py

# In another terminal, test the endpoint
curl -X POST http://localhost:5000/analyze \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "This is a test",
    "history_last10": [],
    "typing": {}
  }'
```

Expected success response:
```json
{
  "success": true,
  "analysis": {
    "ekman": {
      "happiness": 0-100,
      "sadness": 0-100,
      ...
    },
    "valence": 0-100,
    "arousal": 0-100
  }
}
```

Expected error response:
```json
{
  "success": false,
  "error": "Error message",
  "errorDetail": "Additional details"
}
```

## Step-by-Step Fix

1. **Check Prerequisites**
   ```bash
   python3 tests/test_diagnose.py
   ```

2. **Set Environment Variables**
   ```bash
   export OPENROUTER_API_KEY="sk-..."  # OR use HF_TOKEN
   ```

3. **Install Dependencies**
   ```bash
   python3 -m pip install --break-system-packages -r requirements.txt
   ```

4. **Verify Installation**
   ```bash
   python3 -c "import openai, flask, torch; print('All modules loaded successfully')"
   ```

5. **Start Flask Service**
   ```bash
   cd /home/prometheus/project/Sentiment_Analysis
   python3 main.py
   ```
   Look for: `Running on http://0.0.0.0:5000`

6. **Test in Another Terminal**
   ```bash
   curl -X POST http://localhost:5000/analyze \
     -H 'Content-Type: application/json' \
     -d '{"text":"Test","history_last10":[],"typing":{}}'
   ```

7. **Check Node.js Logs**
   ```bash
   pm2 logs server --err
   ```

8. **If Still Failing**
   - Check firewall: `sudo ufw allow 5000`
   - Check Flask binding: `netstat -tlnp | grep 5000`
   - Increase timeout in Node.js backend to 45000ms
   - Check API key validity and rate limits

## Configuration Files

### Environment (.env or shell export)
```bash
OPENROUTER_API_KEY=sk-or-...
# OR
HF_TOKEN=hf_...
HF_MODEL_URL=https://router.huggingface.co/v1  # Optional
```

### Flask Service (main.py)
- Port: 5000 (configurable)
- Route: POST /analyze
- Timeout: 30s (from openai client)

### Node.js Backend Connection (saService.js)
- Must match Python service URL
- Default: http://localhost:5000/analyze
- Timeout: 30000ms (consider increasing to 45000ms)

## Performance Optimization

For faster responses:
1. Use smaller/faster models
2. Cache model on first request
3. Implement connection pooling
4. Add request queue with priorities
5. Consider Docker containers for isolation

## Contact & Logs

- Python Service Logs: Check Flask console output
- Node.js Backend Logs: `pm2 logs server --err`
- Python Diagnostic: `python3 tests/test_diagnose.py`
- API Integration Test: `python3 tests/test_api_integration.py`
