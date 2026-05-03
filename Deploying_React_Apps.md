# Deploying React Apps to AWS EC2 with Nginx

## Prerequisites:
1. AWS EC2 instance: You need to have an EC2 instance running (Ubuntu, Amazon Linux, etc.).

2. Node.js and npm installed on the EC2 instance (for building the React app).

3. Nginx installed on the EC2 instance (for serving the built React app).


## Step 1: Set up your EC2 instance

Launch an EC2 instance (preferably with Ubuntu).

Ensure that your security group allows HTTP (port 80) and SSH (port 22) access.

SSH into the instance using your private key:
```
ssh -i "your-key.pem" ubuntu@your-ec2-ip
```

## Step 2: Install dependencies on the EC2 instance
### Install Nginx:
```
sudo apt update
sudo apt install nginx
```

### Install Node.js and npm (if not already installed):
```
# Install Node.js (latest version)
curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs
```

### Verify Node.js and npm:
```
node -v
npm -v
```

## Step 3: Transfer your React app to EC2
### Option 1: Using scp (Secure Copy Protocol)
```
scp -i "your-key.pem" -r /path/to/your/react-app ubuntu@your-ec2-ip:/home/ubuntu
```

### Option 2: Using Git:
You can clone your repository directly on the EC2 instance:
```
cd /home/ubuntu
git clone https://github.com/yourusername/your-react-app.git
```

## Step 4: Build the React app
### Navigate to the app folder:
```
cd /home/ubuntu/your-react-app
```

### Install dependencies:
```
npm install
```

### Build the app for production:
```
npm run build
```

## Step 5: Configure Nginx to serve the React app

### Create a new Nginx configuration file:
```
sudo nano /etc/nginx/sites-available/react-app
```

### Add the following Nginx config:
```
server {
    listen 80;
    server_name your-ec2-ip;  # You can also use a domain here

    location / {
        root /home/ubuntu/your-react-app/build;
        try_files $uri /index.html;
    }
}
```

### Create a symbolic link to enable the site:
```
sudo ln -s /etc/nginx/sites-available/react-app /etc/nginx/sites-enabled/
```

### Test Nginx configuration:
```
sudo nginx -t
```

### Restart Nginx:
```
sudo systemctl restart nginx
```

## Step 6: Open the appropriate ports in the EC2 security group

Make sure port 80 (HTTP) / PORT is open in the security group for your EC2 instance, allowing public access to the app.


## Step 7: Access the React app
Now, you can visit your EC2 public IP (or domain if you've set it up) in a browser:
```
http://your-ec2-ip:port
```


# 500 internal server error or Permission issue 

## Step 1: Check Nginx error logs
```
sudo tail -f /var/log/nginx/error.log
```

## Step 2: Double-check your Nginx config
Make sure the root path in your config is correct and points to the React build folder, like:
```
server {
    listen 80;
    server_name your-ec2-ip;

    location / {
        root /home/ubuntu/your-react-app/build;
        index index.html;
        try_files $uri /index.html;
    }
}
```
Also verify that this file is linked inside /etc/nginx/sites-enabled.


## Step 3: Check file permissions
Ensure Nginx can access your build folder:

```
sudo chmod -R 755 /home/ubuntu/your-react-app/build
```
And if needed:
```
sudo chown -R www-data:www-data /home/ubuntu/your-react-app/build
```

## Step 4: Restart Nginx
```
sudo nginx -t  # Test the config
sudo systemctl restart nginx
```

## Step 5: Build folder exists?
Confirm that the build actually worked:
```
ls /home/ubuntu/your-react-app/build
```
You should see files like index.html, static/, etc. If not, build again:
```
npm run build
```

# Permission Issue 

##  1. Allow Nginx to traverse parent directories
```
sudo chmod +x /home
sudo chmod +x /home/ubuntu
sudo chmod +x /home/ubuntu/ratting_app
sudo chmod -R 755 /home/ubuntu/ratting_app/dist
```
This gives Nginx access to walk through the folders and reach index.html.


## 2. (Optional but recommended) Set correct ownership
Sometimes Nginx needs the files to be owned (or at least accessible) by www-data.
```
sudo chown -R www-data:www-data /home/ubuntu/ratting_app/dist
```

##  3. Restart Nginx
```
sudo nginx -t  # Test config
sudo systemctl restart nginx
```

## 4. Test again
Now hit your browser:
```
http://your-ip:port
```



