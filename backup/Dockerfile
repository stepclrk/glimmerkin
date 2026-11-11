# The backup job: the Postgres client tools (pg_dump, psql) plus openssl for encryption.
FROM postgres:16-alpine
RUN apk add --no-cache openssl
COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh
ENTRYPOINT ["/usr/local/bin/backup.sh"]
CMD ["loop"]
