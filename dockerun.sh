sudo docker build -t demo-app:latest .
sudo docker save -o demo-app.tar demo-app:latest
sudo k3s ctr images import demo-app.tar

