#!/bin/sh
set -e

echo "🚀 Starting NodeBB Docker container..."
echo "📋 Container startup initiated at $(date)"

# Wait for database to be ready
echo "⏳ Waiting for PostgreSQL to be ready at ${DB_HOST:-postgres}:${DB_PORT:-5432}..."
while ! nc -z ${DB_HOST:-postgres} ${DB_PORT:-5432}; do
  echo "   🔄 Still waiting for PostgreSQL connection..."
  sleep 1
done
echo "✅ PostgreSQL connection established!"

# Wait for Redis to be ready (for sessions)
echo "⏳ Waiting for Redis to be ready at ${REDIS_HOST:-redis}:${REDIS_PORT:-6379}..."
while ! nc -z ${REDIS_HOST:-redis} ${REDIS_PORT:-6379}; do
  echo "   🔄 Still waiting for Redis connection..."
  sleep 1
done
echo "✅ Redis connection established!"

echo "🎉 Database services are ready!"

# Configure direct-access gate to prevent unauthenticated public browsing
if [ -z "${NODEBB_DIRECT_ACCESS_GATE_ENABLED}" ]; then
  export NODEBB_DIRECT_ACCESS_GATE_ENABLED="true"
fi

if [ -z "${NODEBB_DIRECT_ACCESS_GATE_REDIRECT_URL}" ]; then
  if [ "${NODE_ENV}" = "production" ]; then
    export NODEBB_DIRECT_ACCESS_GATE_REDIRECT_URL="https://app.lets-speek.com/community"
  else
    export NODEBB_DIRECT_ACCESS_GATE_REDIRECT_URL="https://dev.lets-speek.com/community"
  fi
fi

if [ -z "${NODEBB_DIRECT_ACCESS_GATE_COOKIE_NAMES}" ]; then
  export NODEBB_DIRECT_ACCESS_GATE_COOKIE_NAMES="token,express.sid"
fi

echo "🔒 Direct access gate: ${NODEBB_DIRECT_ACCESS_GATE_ENABLED}"
echo "↪️  Direct access redirect: ${NODEBB_DIRECT_ACCESS_GATE_REDIRECT_URL:-<disabled>}"

# Check if database has proper NodeBB PostgreSQL tables (not just Legacy/Redis tables)
echo "🔍 Checking database for existing NodeBB tables..."
echo "   📊 Database: ${DB_NAME}"
echo "   🏠 Host: ${DB_HOST}"
echo "   👤 User: ${DB_USERNAME}"

# The 'users' table is a core PostgreSQL table that NodeBB creates during setup
echo "   🔎 Looking for 'users' table in database..."
DB_HAS_PROPER_TABLES=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USERNAME}" -d "${DB_NAME}" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users' AND table_type = 'BASE TABLE';" 2>/dev/null || echo "0")

echo "   📈 Found ${DB_HAS_PROPER_TABLES} proper PostgreSQL tables"

# If database doesn't have proper PostgreSQL tables (only has Legacy/Redis tables), force fresh setup
if [ "${DB_HAS_PROPER_TABLES}" = "0" ]; then
  echo "⚠️  Database doesn't have proper NodeBB PostgreSQL tables, forcing fresh setup..."
  echo "🗑️  Removing existing config.json to force setup..."
  rm -f /app/config.json
  echo "✅ config.json removed - fresh setup will be triggered"
else
  echo "✅ Database has proper NodeBB tables - skipping setup"
fi

# Non-interactive setup on first run (auto-create admin)
if [ ! -f "/app/config.json" ] || [ ! -s "/app/config.json" ]; then
  echo "🔧 NodeBB not configured, running non-interactive setup..."
  echo "📋 Setup process initiated at $(date)"
  
  NODEBB_URL=${NODEBB_URL:-http://localhost:4567}
  NODEBB_DB=${NODEBB_DB:-postgres}
  NODEBB_ADMIN_USERNAME=${NODEBB_ADMIN_USERNAME:-admin}
  NODEBB_ADMIN_PASSWORD=${NODEBB_ADMIN_PASSWORD:-admin123}
  NODEBB_ADMIN_EMAIL=${NODEBB_ADMIN_EMAIL:-admin@speek.local}

  # Debug: Print environment variables
  echo "🔍 Environment variables debug:"
  echo "   🌐 NODEBB_URL=${NODEBB_URL}"
  echo "   🗄️  NODEBB_DB=${NODEBB_DB}"
  echo "   👤 NODEBB_ADMIN_USERNAME=${NODEBB_ADMIN_USERNAME}"
  echo "   📧 NODEBB_ADMIN_EMAIL=${NODEBB_ADMIN_EMAIL}"
  echo "   🏠 DB_HOST=${DB_HOST}"
  echo "   🔌 DB_PORT=${DB_PORT}"
  echo "   👤 DB_USERNAME=${DB_USERNAME}"
  echo "   🗄️  DB_NAME=${DB_NAME}"
  echo "   🔴 REDIS_HOST=${REDIS_HOST}"
  echo "   🔌 REDIS_PORT=${REDIS_PORT}"
  echo "   🔐 REDIS_PASSWORD=${REDIS_PASSWORD:0:3}***"

  cat > /tmp/setup.json <<EOF
{
  "url": "${NODEBB_URL}",
  "secret": "${NODEBB_SSO_SECRET:-$(openssl rand -hex 32)}",
  "admin:username": "${NODEBB_ADMIN_USERNAME}",
  "admin:email": "${NODEBB_ADMIN_EMAIL}",
  "admin:password": "${NODEBB_ADMIN_PASSWORD}",
  "admin:password:confirm": "${NODEBB_ADMIN_PASSWORD}",
  "database": "postgres",
  "postgres:host": "${DB_HOST}",
  "postgres:port": ${DB_PORT},
  "postgres:username": "${DB_USERNAME}",
  "postgres:password": "${DB_PASSWORD}",
  "postgres:database": "${DB_NAME}",
  "postgres:ssl": {
    "rejectUnauthorized": false
  },
  "redis:host": "${REDIS_HOST}",
  "redis:port": ${REDIS_PORT},
  "redis:password": "${REDIS_PASSWORD}",
  "redis:database": 0,
  "redis:tls": true
}
EOF
  echo "👤 Running NodeBB setup with admin credentials: ${NODEBB_ADMIN_USERNAME} / ${NODEBB_ADMIN_EMAIL}"
  echo "📄 Setup configuration:"
  cat /tmp/setup.json
  echo ""
  echo "🚀 Starting NodeBB setup process..."
  echo "⏳ This may take a few minutes..."
  
  # Run the setup and capture output
  if node app --setup="$(cat /tmp/setup.json)"; then
    echo "✅ NodeBB setup completed successfully!"
    echo "📊 Setup finished at $(date)"
  else
    echo "❌ NodeBB setup failed!"
    echo "💥 Setup failed at $(date)"
    exit 1
  fi
fi

# Apply non-interactive configuration driven by environment variables
echo "🔧 Applying runtime configuration..."
echo "📋 Configuration phase started at $(date)"

# Navigation layout (Harmony)
if [ -n "${NODEBB_NAV}" ]; then
  echo "   🧭 Setting navigation layout: ${NODEBB_NAV}"
  ./nodebb config set harmony:navigation "${NODEBB_NAV}" || echo "   ⚠️  Failed to set navigation"
fi
if [ -n "${NODEBB_SIDEBAR}" ]; then
  echo "   📱 Setting sidebar layout: ${NODEBB_SIDEBAR}"
  ./nodebb config set harmony:sidebar "${NODEBB_SIDEBAR}" || echo "   ⚠️  Failed to set sidebar"
fi

# Lock user appearance/theme switching if requested
if [ "${NODEBB_ALLOW_USER_SKINS}" = "false" ]; then
  echo "   🎨 Disabling user skins"
  ./nodebb config set appearance:allowUserSkins false || echo "   ⚠️  Failed to disable user skins"
  ./nodebb config set theme:allowUserSkins false || echo "   ⚠️  Failed to disable theme skins"
fi
if [ "${NODEBB_ALLOW_THEME_SWITCH}" = "false" ]; then
  echo "   🔄 Disabling theme switching"
  ./nodebb config set appearance:themeSelection false || echo "   ⚠️  Failed to disable theme selection"
  ./nodebb config set harmony:showSkins false || echo "   ⚠️  Failed to hide skins"
fi

# Install & enable session-sharing plugin at boot (idempotent)
echo "🔌 Setting up session-sharing plugin..."
if [ ! -d "node_modules/nodebb-plugin-session-sharing" ]; then
  echo "   📦 Installing nodebb-plugin-session-sharing..."
  npm install nodebb-plugin-session-sharing || echo "   ⚠️  Failed to install session-sharing plugin"
fi
echo "   🔧 Enabling nodebb-plugin-session-sharing..."
./nodebb plugins enable nodebb-plugin-session-sharing || echo "   ⚠️  Failed to enable session-sharing plugin"

# Ensure Speek Harmony theme is installed and activated
echo "🎨 Ensuring Speek Harmony theme is available..."
if [ ! -d "node_modules/nodebb-theme-harmony-speek" ]; then
  echo "   📦 Installing nodebb-theme-harmony-speek from local themes directory..."
  npm install ./themes/nodebb-theme-harmony-speek || echo "   ⚠️  Failed to install Speek Harmony theme"
else
  echo "   ✅ Speek Harmony theme already installed"
fi

echo "   🔧 Activating nodebb-theme-harmony-speek..."
./nodebb activate nodebb-theme-harmony-speek || echo "   ⚠️  Failed to activate Speek Harmony theme"
./nodebb config set theme:id "nodebb-theme-harmony-speek" || echo "   ⚠️  Failed to set Speek Harmony theme as default"

# Configure session-sharing plugin (JWT via cookie)
if [ -n "${NODEBB_SSO_SECRET}" ]; then
  echo "   🔐 Configuring session-sharing plugin..."
  # Set cookie domain for cross-subdomain SSO based on environment
  # Local: no domain (localhost only - host-only cookies)
  # Development: .lets-speek.com (dev.lets-speek.com + dev-community.lets-speek.com + localhost)
  # Staging: .lets-speek.com (test.lets-speek.com + test-community.lets-speek.com)
  # Production: .lets-speek.com (app.lets-speek.com + community.lets-speek.com)
  
  # Determine defaults based on NODE_ENV or explicit override
  if [ -z "${NODEBB_SSO_COOKIE_DOMAIN}" ]; then
    if [ "${NODE_ENV}" = "production" ]; then
      SSO_COOKIE_DOMAIN=".lets-speek.com"
      SSO_HOST_WHITELIST="lets-speek.com,app.lets-speek.com,community.lets-speek.com"
    elif [ "${NODE_ENV}" = "staging" ]; then
      SSO_COOKIE_DOMAIN=".lets-speek.com"
      SSO_HOST_WHITELIST="test.lets-speek.com,test-community.lets-speek.com"
    elif [ "${NODE_ENV}" = "development" ]; then
      # Development - supports both cloud (dev.lets-speek.com) and local (localhost)
      SSO_COOKIE_DOMAIN=".lets-speek.com"
      SSO_HOST_WHITELIST="localhost,127.0.0.1,dev.lets-speek.com,dev-community.lets-speek.com"
    else
      # Local only - no cookie domain (host-only cookies for localhost)
      SSO_COOKIE_DOMAIN=""
      SSO_HOST_WHITELIST="localhost,127.0.0.1"
    fi
  else
    SSO_COOKIE_DOMAIN="${NODEBB_SSO_COOKIE_DOMAIN}"
    SSO_HOST_WHITELIST="${NODEBB_SSO_HOST_WHITELIST:-localhost,127.0.0.1}"
  fi
  
  echo "   🌍 Environment: ${NODE_ENV:-development}"
  echo "   🍪 Cookie domain: ${SSO_COOKIE_DOMAIN:-<host-only>}"
  echo "   🔒 Host whitelist: ${SSO_HOST_WHITELIST}"
  
  # Export variables so Node.js process can access them
  export SSO_COOKIE_DOMAIN
  export SSO_HOST_WHITELIST
  export NODEBB_SSO_SECRET
  
  # Configure session-sharing in database
  echo "   📝 Writing session-sharing configuration to database..."
  node -e "(async()=>{try{const nconf=require('nconf');const db=require('./src/database');nconf.file({file:'config.json'});await db.init(nconf.get('database'));const cookieDomain=process.env.SSO_COOKIE_DOMAIN||undefined;const o={name:process.env.NODEBB_SSO_APPID||'speek',cookieName:'token',cookieDomain:cookieDomain,secret:process.env.NODEBB_SSO_SECRET,behaviour:'revalidate',adminRevalidate:'revalidate',noRegistration:'off',payloadParent:undefined,allowBannedUsers:false,hostWhitelist:process.env.SSO_HOST_WHITELIST||'localhost,127.0.0.1','payload:id':'id','payload:username':'username','payload:email':'email','payload:picture':'picture','payload:fullname':'fullname','payload:isAdmin':'isAdmin'};await db.setObject('settings:session-sharing',o);await db.close();console.log('✅ session-sharing configured:',JSON.stringify({cookieName:o.cookieName,domain:o.cookieDomain||'<host-only>',whitelist:o.hostWhitelist,behaviour:o.behaviour,adminRevalidate:o.adminRevalidate},null,2));}catch(e){console.error('❌ Failed to configure session-sharing:',e.message);console.error(e.stack);process.exit(1);}})()"
  
  if [ $? -eq 0 ]; then
    echo "   ✅ Session-sharing configuration completed successfully"
  else
    echo "   ❌ Session-sharing configuration failed!"
    exit 1
  fi
else
  echo "   ℹ️  No SSO secret provided, skipping session-sharing configuration"
fi

# Iframe embedding headers: disable X-Frame-Options and set CSP frame-ancestors
echo "🖼️  Configuring iframe embedding..."
if [ -n "${NODEBB_FRAME_ANCESTORS}" ]; then
  echo "   🔗 Setting frame ancestors: ${NODEBB_FRAME_ANCESTORS}"
  ./nodebb config set "csp-frame-ancestors" "${NODEBB_FRAME_ANCESTORS}" || echo "   ⚠️  Failed to set frame ancestors"
else
  # Set default frame ancestors based on environment
  if [ "${NODE_ENV}" = "production" ]; then
    FRAME_ANCESTORS="https://app.lets-speek.com"
  elif [ "${NODE_ENV}" = "staging" ]; then
    FRAME_ANCESTORS="https://test.lets-speek.com"
  elif [ "${NODE_ENV}" = "development" ]; then
    FRAME_ANCESTORS="http://localhost:3000 http://127.0.0.1:3000 https://dev.lets-speek.com"
  else
    FRAME_ANCESTORS="http://localhost:3000 http://127.0.0.1:3000"
  fi
  echo "   🏠 Setting frame ancestors for ${NODE_ENV:-development}: ${FRAME_ANCESTORS}"
  ./nodebb config set "csp-frame-ancestors" "${FRAME_ANCESTORS}" || echo "   ⚠️  Failed to set frame ancestors via CLI"
fi

# Set CSP frame-ancestors directly in database (more reliable)
echo "   📝 Writing CSP frame-ancestors to database..."
export FRAME_ANCESTORS
node -e "(async()=>{try{const nconf=require('nconf');const db=require('./src/database');nconf.file({file:'config.json'});await db.init(nconf.get('database'));await db.setObjectField('config','csp-frame-ancestors',process.env.FRAME_ANCESTORS);console.log('✅ CSP frame-ancestors set to:',process.env.FRAME_ANCESTORS);await db.close();}catch(e){console.error('❌ Failed to set CSP frame-ancestors:',e.message);process.exit(1);}})()"

echo "   🚫 Disabling X-Frame-Options"
./nodebb config set xframe disabled || echo "   ⚠️  Failed to disable X-Frame-Options via CLI"
# Remove X-Frame-Options from database
node -e "(async()=>{try{const nconf=require('nconf');const db=require('./src/database');nconf.file({file:'config.json'});await db.init(nconf.get('database'));await db.deleteObjectField('config','frame-options');await db.deleteObjectField('config','allow-from-uri');console.log('✅ X-Frame-Options removed from database');await db.close();}catch(e){console.error('⚠️  Failed to remove X-Frame-Options:',e.message);}})()"

# Configure cross-origin policies for iframe embedding
echo "   🌐 Configuring cross-origin policies..."
node -e "(async()=>{try{const nconf=require('nconf');const db=require('./src/database');nconf.file({file:'config.json'});await db.init(nconf.get('database'));await db.setObjectField('config','cross-origin-embedder-policy',1);await db.setObjectField('config','cross-origin-opener-policy','unsafe-none');await db.setObjectField('config','cross-origin-resource-policy','cross-origin');console.log('✅ Cross-origin policies configured (COEP: require-corp, COOP: unsafe-none, CORP: cross-origin)');await db.close();}catch(e){console.error('⚠️  Failed to set cross-origin policies:',e.message);}})()"

# Set Permissions-Policy for iframe embedding
echo "   🔐 Configuring Permissions-Policy for iframe features..."
if [ -n "${NODEBB_PERMISSIONS_POLICY}" ]; then
  PERMISSIONS_POLICY="${NODEBB_PERMISSIONS_POLICY}"
  echo "   📋 Using custom Permissions-Policy"
else
  # Set default permissions based on environment
  if [ "${NODE_ENV}" = "production" ]; then
    PERMISSIONS_POLICY="fullscreen=(self \"https://app.lets-speek.com\"), clipboard-write=(self \"https://app.lets-speek.com\"), clipboard-read=(self \"https://app.lets-speek.com\")"
  elif [ "${NODE_ENV}" = "staging" ]; then
    PERMISSIONS_POLICY="fullscreen=(self \"https://test.lets-speek.com\"), clipboard-write=(self \"https://test.lets-speek.com\"), clipboard-read=(self \"https://test.lets-speek.com\")"
  elif [ "${NODE_ENV}" = "development" ]; then
    PERMISSIONS_POLICY="fullscreen=(self \"http://localhost:3000\" \"https://dev.lets-speek.com\"), clipboard-write=(self \"http://localhost:3000\" \"https://dev.lets-speek.com\"), clipboard-read=(self \"http://localhost:3000\" \"https://dev.lets-speek.com\")"
  else
    PERMISSIONS_POLICY="fullscreen=(self \"http://localhost:3000\"), clipboard-write=(self \"http://localhost:3000\"), clipboard-read=(self \"http://localhost:3000\")"
  fi
  echo "   🎯 Setting Permissions-Policy for ${NODE_ENV:-development}"
fi

# Set Permissions-Policy in database
export PERMISSIONS_POLICY
node -e "(async()=>{try{const nconf=require('nconf');const db=require('./src/database');nconf.file({file:'config.json'});await db.init(nconf.get('database'));await db.setObjectField('config','permissions-policy',process.env.PERMISSIONS_POLICY);await db.close();console.log('✅ Permissions-Policy configured');}catch(e){console.error('⚠️  Failed to set Permissions-Policy:',e.message);}})()" || echo "   ⚠️  Permissions-Policy configuration failed"

# Apply custom CSS from /app/nodebb.css
if [ -f "/app/nodebb.css" ]; then
  echo "🎨 Applying custom CSS from nodebb.css..."
  node -e "const fs=require('fs');const nconf=require('nconf');const db=require('./src/database');(async()=>{try{nconf.file({file:'config.json'});await db.init(nconf.get('database'));await db.setObjectField('config','customCSS',fs.readFileSync('nodebb.css','utf8'));await db.setObjectField('config','useCustomCSS',true);await db.close();console.log('customCSS set');}catch(e){console.error('Warning: Failed to set custom CSS:',e.message);}})()" || echo "   ⚠️  Custom CSS configuration failed"
  ./nodebb config set useCustomCSS true || echo "   ⚠️  Failed to enable custom CSS"
else
  echo "   ℹ️  No custom CSS file found, skipping"
fi

# Rebuild assets after any config change
echo "🔨 Building NodeBB assets..."
echo "   ⏳ This may take a few minutes..."
if ./nodebb build; then
  echo "   ✅ Assets built successfully!"
else
  echo "   ⚠️  Asset build failed, continuing anyway..."
fi

echo "🎉 All configuration complete!"
echo "🚀 Starting NodeBB server..."
echo "📊 Server startup initiated at $(date)"
exec "$@"
