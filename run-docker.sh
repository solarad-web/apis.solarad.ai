docker build --no-cache -t apis.solarad.ai .

docker run --rm -p 80:80 \
  --pid=host \
  -v /home/ec2-user/efs-solarad-output:/home/ \
  -it apis.solarad.ai
