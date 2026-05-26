"""
Simple diagnostic test for sentiment analysis service
Tests basic functionality without external dependencies
"""

import sys
import os
import json
import subprocess
from pathlib import Path


def check_file_exists(filepath):
    """Check if a file exists"""
    return os.path.exists(filepath)


def check_imports():
    """Check what modules are available"""
    required_modules = ['flask', 'openai', 'torch', 'readchar', 'dotenv']
    available = {}
    
    for module in required_modules:
        try:
            __import__(module)
            available[module] = True
        except ImportError:
            available[module] = False
    
    return available


def check_env_setup():
    """Check environment configuration"""
    checks = {
        'OPENROUTER_API_KEY': bool(os.getenv('OPENROUTER_API_KEY')),
        'HF_TOKEN': bool(os.getenv('HF_TOKEN')),
        'HF_MODEL_URL': bool(os.getenv('HF_MODEL_URL')),
    }
    return checks


def check_file_structure():
    """Check project file structure"""
    base_path = os.path.dirname(os.path.dirname(__file__))
    files_to_check = {
        'main.py': os.path.join(base_path, 'main.py'),
        'src/analyzer.py': os.path.join(base_path, 'src', 'analyzer.py'),
        'src/display.py': os.path.join(base_path, 'src', 'display.py'),
        'src/history.py': os.path.join(base_path, 'src', 'history.py'),
        'requirements.txt': os.path.join(base_path, 'requirements.txt'),
    }
    
    structure = {}
    for name, path in files_to_check.items():
        structure[name] = check_file_exists(path)
    
    return structure


def check_flask_syntax():
    """Check if main.py has valid Python syntax"""
    base_path = os.path.dirname(os.path.dirname(__file__))
    main_py = os.path.join(base_path, 'main.py')
    
    try:
        with open(main_py, 'r') as f:
            compile(f.read(), main_py, 'exec')
        return True, None
    except SyntaxError as e:
        return False, str(e)


def check_analyzer_syntax():
    """Check if analyzer.py has valid Python syntax"""
    base_path = os.path.dirname(os.path.dirname(__file__))
    analyzer_py = os.path.join(base_path, 'src', 'analyzer.py')
    
    try:
        with open(analyzer_py, 'r') as f:
            compile(f.read(), analyzer_py, 'exec')
        return True, None
    except SyntaxError as e:
        return False, str(e)


def run_diagnostics():
    """Run all diagnostics"""
    print("=" * 60)
    print("SENTIMENT ANALYSIS SERVICE DIAGNOSTIC TEST")
    print("=" * 60)
    
    # 1. File structure
    print("\n1. PROJECT STRUCTURE CHECK")
    print("-" * 40)
    structure = check_file_structure()
    for file, exists in structure.items():
        status = "✓" if exists else "✗"
        print(f"  {status} {file}")
    
    all_files_exist = all(structure.values())
    if all_files_exist:
        print("  ✓ All project files present")
    else:
        print("  ✗ Some files are missing")
    
    # 2. Environment setup
    print("\n2. ENVIRONMENT CONFIGURATION CHECK")
    print("-" * 40)
    env = check_env_setup()
    for key, value in env.items():
        status = "✓" if value else "✗"
        print(f"  {status} {key}")
    
    if not (env['OPENROUTER_API_KEY'] or env['HF_TOKEN']):
        print("  ⚠ ERROR: No API credentials configured!")
        print("    - Set OPENROUTER_API_KEY or HF_TOKEN")
    
    # 3. Module availability
    print("\n3. DEPENDENCY CHECK")
    print("-" * 40)
    modules = check_imports()
    for module, available in modules.items():
        status = "✓" if available else "✗"
        print(f"  {status} {module}")
    
    missing = [m for m, a in modules.items() if not a]
    if missing:
        print(f"\n  ⚠ Missing modules: {', '.join(missing)}")
        print("  Install with: pip install -r requirements.txt")
    
    # 4. Syntax checks
    print("\n4. PYTHON SYNTAX CHECK")
    print("-" * 40)
    
    main_ok, main_err = check_flask_syntax()
    print(f"  {'✓' if main_ok else '✗'} main.py syntax")
    if main_err:
        print(f"    Error: {main_err}")
    
    analyzer_ok, analyzer_err = check_analyzer_syntax()
    print(f"  {'✓' if analyzer_ok else '✗'} src/analyzer.py syntax")
    if analyzer_err:
        print(f"    Error: {analyzer_err}")
    
    # 5. Detailed analysis
    print("\n5. POTENTIAL ISSUES FROM NODE.JS LOGS")
    print("-" * 40)
    print("  Issue: 'response.errorDetail is not a function'")
    print("    → Likely cause: errorDetail property is a function instead of string/object")
    print("    → Solution: Check error response structure in saService.js")
    print()
    print("  Issue: 'Python Sentiment Service Unavailable'")
    print("    → Likely causes:")
    print("      1. Flask service not running")
    print("      2. Network connectivity issues")
    print("      3. Missing API credentials")
    print("      4. Python dependencies not installed")
    print()
    print("  Issue: 'timeout of 30000ms exceeded'")
    print("    → Likely causes:")
    print("      1. API calls taking longer than 30 seconds")
    print("      2. Network latency to HuggingFace/OpenRouter")
    print("      3. Model loading time on first request")
    
    # 6. Recommendations
    print("\n6. RECOMMENDED STEPS")
    print("-" * 40)
    print("  1. Install Python dependencies:")
    print("     python3 -m pip install --break-system-packages -r requirements.txt")
    print()
    print("  2. Verify environment variables:")
    print("     echo $OPENROUTER_API_KEY")
    print("     echo $HF_TOKEN")
    print()
    print("  3. Start Flask service:")
    print("     cd /home/prometheus/project/Sentiment_Analysis")
    print("     python3 main.py")
    print()
    print("  4. Test the /analyze endpoint:")
    print("     curl -X POST http://localhost:5000/analyze \\")
    print("       -H 'Content-Type: application/json' \\")
    print("       -d '{\"text\": \"This is a test\", \"history_last10\": [], \"typing\": {}}'")
    print()
    print("  5. Check Node.js backend logs:")
    print("     pm2 logs --err")
    print()
    
    # Summary
    print("\n" + "=" * 60)
    print("DIAGNOSTIC SUMMARY")
    print("=" * 60)
    all_ok = all_files_exist and all(modules.values()) and main_ok and analyzer_ok
    if all_ok:
        print("✓ All checks passed! Service should be operational.")
    else:
        print("✗ Some checks failed. See details above.")
    
    return all_ok


if __name__ == '__main__':
    success = run_diagnostics()
    sys.exit(0 if success else 1)
