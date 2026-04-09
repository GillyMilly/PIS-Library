FROM nginx:1.27-alpine

WORKDIR /usr/share/nginx/html

RUN rm -rf ./*

COPY index.html ./
COPY styles.css ./
COPY app.js ./
COPY data.json ./

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
