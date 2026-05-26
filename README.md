# Cricketpro

import sys
import os

# 1. Path to your project folder
path = '/home/suman0405/personal_web'
if path not in sys.path:
    sys.path.insert(0, path)

# 2. Import your Flask app
# This looks for 'app' inside a file named 'app.py'
from app import app as application
