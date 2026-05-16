# Chạy server django

---

## 1. Cài script

iot_base.sh

```
#!/bin/bash
PROJECT_DIR="/home/dat/project_dat/django-web-blog/iot_base"
VENV_PATH="/home/dat/project_dat/django-web-blog/myenv1/bin/activate"
source "$VENV_PATH"
cd "$PROJECT_DIR"
python3 manage.py runserver 0.0.0.0:5600
deactivate
```

## 2. Cài service

iot_base.service

-  Tạo file iot_base.service

```
sudo nano /etc/systemd/system/iot_base.service
```
- Chỉnh sửa

```
[Unit]
Description=Service cho du an iot_base
After=network.target

[Service]
User=dat
WorkingDirectory=/home/dat/project_dat/django-web-blog/iot_base
ExecStart=/bin/bash /home/dat/project_dat/django-web-blog/iot_base/iot_bash.sh
Restart=always

[Install]
WantedBy=multi-user.target

```
- Thiết lập systemd

```
sudo systemctl daemon-reload
sudo systemctl enable iot_base
sudo systemctl restart iot_base

```

- kiểm tra trạng thái

```
sudo systemctl status iot_base

```
