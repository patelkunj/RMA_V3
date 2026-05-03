# Deploying Full Stack Apps to AWS EC2 with SQL Databases


## Setup EC2 Instance

```
sudo apt update
sudo apt upgrade
```

## Install Node.js
```
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## rsync

```
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude '.env' \
-e "ssh -i ~/.ssh/your-key.pem" \
. ubuntu@ip-address:~/app
```


## Database

### mysql
```
sudo apt install mysql-server

sudo systemctl start mysql
sudo systemctl enable mysql

sudo mysql -u root
```

### Postgres
```
sudo apt install postgresql postgresql-contrib

sudo systemctl start postgresql
sudo systemctl enable postgresql

sudo -i -u postgres
```

```
CREATE DATABASE my_app;
CREATE ROLE my_app_role WITH LOGIN PASSWORD 'some_password';
GRANT ALL PRIVILEGES ON DATABASE "my_app" TO my_app_role;
```

# systemd

## Step 1: Create the Environment File

Create a new file for your environment variables and open the file in Vim:

```
sudo vim /etc/app.env
```

In Vim, add your variables in the format VARIABLE=value. For example:

```
DB_PASSWORD=your_secure_password
```

Restrict the file permissions for security.

```
sudo chmod 600 /etc/app.env
sudo chown ubuntu:ubuntu /etc/app.env
```

## Step 2: Create the systemd Service File

Navigate to the systemd directory and create a new service file with your app name, [myapp.service].
```
sudo vim /etc/systemd/system/myapp.service
```

Define the service settings. Add the following content in Vim, modifying as needed for your application:

```
[Unit]
Description=Node.js App
After=network.target multi-user.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/app
ExecStart=/usr/bin/npm start
Restart=always
Environment=NODE_ENV=production
EnvironmentFile=/etc/app.env
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=myapp

[Install]
WantedBy=multi-user.target
```

Reload systemd and start your service.
```
sudo systemctl daemon-reload
sudo systemctl enable myapp.service
sudo systemctl start myapp.service
```

Verify that the service is running properly.
```
sudo systemctl status myapp.service
```





