#!/bin/bash
# 创建简单的 1x1 像素透明 PNG 占位图

# 使用 base64 编码的 1x1 透明 PNG
TRANSPARENT_PNG="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

echo "$TRANSPARENT_PNG" | base64 -d > ai.png
echo "$TRANSPARENT_PNG" | base64 -d > practice.png
echo "$TRANSPARENT_PNG" | base64 -d > check.png
echo "$TRANSPARENT_PNG" | base64 -d > uncheck.png
echo "$TRANSPARENT_PNG" | base64 -d > happy.png
echo "$TRANSPARENT_PNG" | base64 -d > sad.png
echo "$TRANSPARENT_PNG" | base64 -d > correct.png
echo "$TRANSPARENT_PNG" | base64 -d > wrong.png

echo "占位图片已创建"
