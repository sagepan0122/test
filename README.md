
# test
=======
# 宠物日程提醒

一个基于 React + Vite 的移动端界面，用来还原 Figma 里的“宠物日程提醒”设计。包含切换宠物、标记待办完成、添加新宠等交互。

## 快速启动

```bash
npm install
npm run dev           # 开发模式，默认 http://localhost:5173
npm run build         # 产物输出在 dist/
```

如果需要在手机上调试，可以运行 `npm run dev -- --host`，然后用同一局域网里的手机访问日志里显示的地址。

## 自定义图标 / 素材

项目里所有图片都集中在 `src/App.tsx` 的 `assets` 对象。为了方便替换“提醒图标”，额外暴露了一个环境变量：

1. 在根目录创建 `.env`。
2. 写入 `VITE_TASK_ICON_URL=你的图标地址`。地址既可以是公网 URL，也可以是放在 `public/` 目录下的资源，例如 `VITE_TASK_ICON_URL=/icons/injection.svg`。
3. 重启 `npm run dev` 后即可看到新的图标。

其余背景、贴图（包括顶部记事本/猫狗、底部小猫按钮）同理：把图片放进 `public/` 并更新 `assets` 对应字段即可；例如顶部目前同时使用 `heroNotebookImage`、`heroPetsImage` 两张贴纸，可以直接替换为你自己的素材。

## GitHub Pages 发布

仓库已经包含 `.github/workflows/deploy.yml`，当推送到 `main` 分支时会自动：

1. 安装依赖并运行 `npm run build`。
2. 将 `dist/` 打包为 Pages 工件。
3. 发布到 GitHub Pages 环境。

只需在 **Settings → Pages** 中把 Source 调整为 **GitHub Actions**，部署完成后访问 `https://<你的用户名>.github.io/test/` 即可。

## 目录结构（节选）

```
pet-reminder
├─ public/            # 静态资源，可放自定义 icon
├─ src/
│  ├─ App.tsx         # 主界面和交互
│  ├─ App.css         # 样式
│  ├─ index.css       # 全局样式与字体
│  └─ main.tsx
└─ README.md
```

## 设计同步说明

- 顶部背景直接使用 node `4:143` 的整幅贴图（含记事本与猫狗），其他元素如底部小猫按钮也都来自 Figma 导出的原图 URL。
- Tab、提醒卡片、小猫浮动按钮都支持点击；完成按钮会直接移除对应卡片并保持列表整洁。
- 空状态、提醒倒计时等文案可在 `initialSchedules` 与表单逻辑里调整。需要接入真实数据时，替换该数据源即可。
