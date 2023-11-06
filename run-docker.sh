docker build --no-cache -t fenice-api .

docker run --rm -p 80:3000 \
  --pid=host \
  -v /home/ec2-user/efs-solarad-output:/home/ \
  -it fenice-api