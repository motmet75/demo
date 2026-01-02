 docker build -t demo-app:latest .
 docker save -o demo-app.tar demo-app:latest
 k3s ctr images import demo-app.tar

