docker build --no-cache -t fenice-api .

docker run --rm -p 80:3000 \
  -v /home/ec2-user/s3-solaradoutput/Fenice/:/home/Fenice/
  -it fenice-api