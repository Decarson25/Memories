const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const preview = document.getElementById('preview');
const uploadBtn = document.getElementById('uploadBtn');
const progressBar = document.getElementById('progress');
const successMessage = document.getElementById('successMessage');
let filesToUpload = [];

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

uploadArea.addEventListener('click', (e) => {
    fileInput.click();
});

uploadArea.addEventListener('dragover', (e) => {
    uploadArea.style.borderColor = '#de6360'; // Roman
});

uploadArea.addEventListener('dragleave', (e) => {
    uploadArea.style.borderColor = '#a50b5e'; // Jazzberry Jam
});

uploadArea.addEventListener('drop', (e) => {
    uploadArea.style.borderColor = '#a50b5e'; // Jazzberry Jam
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
    e.preventDefault(); // Prevent any default behavior
    handleFiles(e.target.files);
});

const debouncedUpdatePreview = debounce(updatePreview, 100);

function handleFiles(files) {
    performance.mark('handleFiles-start');
    filesToUpload = filesToUpload.concat(Array.from(files));
    debouncedUpdatePreview();
    performance.mark('handleFiles-end');
    performance.measure('handleFiles', 'handleFiles-start', 'handleFiles-end');
    console.log('handleFiles duration:', performance.getEntriesByName('handleFiles')[0].duration, 'ms');
}

function updatePreview() {
    performance.mark('updatePreview-start');
    requestAnimationFrame(() => {
        // Only append new files instead of clearing
        const existingItems = Array.from(preview.children);
        const existingIndices = existingItems.map(item => parseInt(item.dataset.index, 10));
        const newFiles = filesToUpload.filter((_, index) => !existingIndices.includes(index));

        uploadBtn.disabled = filesToUpload.length === 0;

        newFiles.forEach((file, relativeIndex) => {
            const index = filesToUpload.indexOf(file);
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.dataset.index = index;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.textContent = 'X';
            div.appendChild(removeBtn);

            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    div.insertBefore(img, removeBtn);
                };
                reader.readAsDataURL(file);
            } else if (file.type.startsWith('video/')) {
                const video = document.createElement('video');
                video.src = URL.createObjectURL(file);
                video.poster = video.src;
                video.preload = 'metadata';
                video.muted = true;
                div.insertBefore(video, removeBtn);
            } else {
                const placeholder = document.createElement('div');
                placeholder.className = 'placeholder';
                placeholder.textContent = file.name;
                div.insertBefore(placeholder, removeBtn);
            }

            preview.appendChild(div);
        });

        // Update indices of existing items
        Array.from(preview.children).forEach((item, i) => {
            const index = filesToUpload.indexOf(filesToUpload[i]);
            if (index !== -1) item.dataset.index = index;
        });

        performance.mark('updatePreview-end');
        performance.measure('updatePreview', 'updatePreview-start', 'updatePreview-end');
        console.log('updatePreview duration:', performance.getEntriesByName('updatePreview')[0].duration, 'ms');
    });
}

// Event delegation for remove buttons
preview.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent any default behavior
    if (e.target.classList.contains('remove-btn')) {
        performance.mark('removeBtn-start');
        const parent = e.target.parentElement;
        const index = parseInt(parent.dataset.index, 10);
        filesToUpload.splice(index, 1);
        parent.remove(); // Remove only the specific thumbnail
        // Update indices of remaining items
        Array.from(preview.children).forEach((item, i) => {
            const newIndex = filesToUpload.indexOf(filesToUpload[i]);
            if (newIndex !== -1) item.dataset.index = newIndex;
        });
        uploadBtn.disabled = filesToUpload.length === 0;
        performance.mark('removeBtn-end');
        performance.measure('removeBtn', 'removeBtn-start', 'removeBtn-end');
        console.log('removeBtn duration:', performance.getEntriesByName('removeBtn')[0].duration, 'ms');
    }
});

uploadBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    uploadBtn.disabled = true;
    progressBar.style.width = '0%';
    progressBar.textContent = '0%';
    successMessage.style.display = 'none';

    const totalFiles = filesToUpload.length;
    let uploaded = 0;

    const uploadPromises = filesToUpload.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const totalSize = file.size;
        let loaded = 0;

        const simulateProgress = setInterval(() => {
            loaded += totalSize / 10;
            const fileProgress = (loaded / totalSize) * 100;
            const overallProgress = ((uploaded + fileProgress / totalFiles) / totalFiles) * 100;
            progressBar.style.width = `${Math.min(overallProgress, 99)}%`;
            progressBar.textContent = `${Math.round(Math.min(overallProgress, 99))}%`;
            if (loaded >= totalSize) clearInterval(simulateProgress);
        }, 100);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }

            await response.json();
            uploaded++;
            return { success: true, file };
        } catch (err) {
            console.error('Upload error:', err);
            clearInterval(simulateProgress);
            return { success: false, file };
        }
    });

    const results = await Promise.all(uploadPromises);

    const allSuccessful = results.every(result => result.success);
    if (allSuccessful && totalFiles > 0) {
        progressBar.style.width = '100%';
        progressBar.textContent = '100%';
        successMessage.style.display = 'block';
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 5000);
        filesToUpload = [];
        preview.innerHTML = '';
        uploadBtn.disabled = true;
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';
    } else {
        alert('Some uploads failed. Please try again.');
        uploadBtn.disabled = false;
    }
});
