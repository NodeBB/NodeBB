FROM python:3.11

# Install system libraries
RUN apt-get update && \
    apt-get install -y \
    libnss3 \
    libnssutil3 \
    libsmime3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libexpat1 \
    libxcb1 \
    libxkbcommon0 \
    libatspi0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2

# Set up the working directory
WORKDIR /app

# Copy the requirements file
COPY requirements.txt .

# Install Python packages
RUN pip install -r requirements.txt

# Copy your application code
COPY . .

# Run your application
CMD ["python", "main.py"]



