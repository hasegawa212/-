#!/usr/bin/env bash
# Netlify の publish ディレクトリ _site を組み立てる。
#
# 既存サイト「hearing-martialarts」は echo-interview-console を **ルート** で公開して
# いるため、そのURLを変えないよう echo-interview-console の中身をルートに置く。
# 追加ツールはサブディレクトリに並べる。
#
# ツールを増やすときは下の cp を1行足すだけ。ビルドツールは使わない
# （このリポジトリのサブプロジェクトはいずれもゼロ依存の静的ファイル）。
set -euo pipefail

rm -rf _site
mkdir -p _site

# ルート: 反響面談コンソール（既存URL維持）
cp -R echo-interview-console/. _site/

# サブディレクトリ: 資金繰りダッシュボード
mkdir -p _site/cashflow-dashboard
cp -R cashflow-dashboard/. _site/cashflow-dashboard/

echo "built _site:"
find _site -maxdepth 2 -type f | sort
