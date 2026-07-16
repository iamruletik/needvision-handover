#!/bin/bash

while getopts e:h:a:p: flag
do
    case "${flag}" in
        e) env=${OPTARG};;
        h) host=${OPTARG};;
        a) apihost=${OPTARG};;
        p) port=${OPTARG:-3000};;
    esac
done

echo "PORT=$port" > .env
echo "PUBLIC_ENV=$env" >> .env
echo "HOST=$host" >> .env
echo "PUBLIC_API_HOST=$apihost" >> .env
