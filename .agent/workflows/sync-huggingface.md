---
description: Sync HuggingFace Space with local changes
---

# Workflow: Sync HuggingFace Space

This workflow syncs the local `huggingface-space` folder with the HuggingFace Space repository.

## Steps

// turbo-all

1. Navigate to the huggingface-space directory:
```powershell
cd c:\Users\Do2anjos\Desktop\classy-main\huggingface-space
```

2. Check current status:
```powershell
git status
```

3. Add all changes:
```powershell
git add .
```

4. Commit with a descriptive message:
```powershell
git commit -m "update: sync changes to HuggingFace Space"
```

5. Push to HuggingFace:
```powershell
git push origin main
```

## Notes
- The remote is already configured with authentication
- HuggingFace Space URL: https://huggingface.co/spaces/do2anjos/eduscore-yolo-api
- The Space will automatically rebuild after push
