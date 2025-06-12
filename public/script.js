const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const preview = document.getElementById('preview');
const uploadBtn = document.getElementById('uploadBtn');
const progressBar = document.getElementById('progress');
const successMessage = document.getElementById('successMessage');
let filesToUpload = [];

uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#de6360'; // Roman
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = '#a50b5e'; // Jazzberry Jam
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#a50b5e'; // Jazzberry Jam
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

function handleFiles(files) {
    filesToUpload = filesToUpload.concat(Array.from(files));
    updatePreview();
}

function updatePreview() {
    preview.innerHTML = '';
    uploadBtn.disabled = filesToUpload.length === 0;

    filesToUpload.forEach((file, index) => {
        const reader = new FileReader();
        const div = document.createElement('div');
        div.className = 'preview-item';

        reader.onload = (e) => {
            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = e.target.result;
                div.appendChild(img);
            } else if (file.type.startsWith('video/')) {
                const video = document.createElement('video');
                video.src = e.target.result;
                video.controls = true;
                div.appendChild(video);
            } else {
                const placeholder = document.createElement('div');
                placeholder.className = 'placeholder';
                placeholder.textContent = file.name;
                div.appendChild(placeholder);
            }

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.textContent = 'X';
            removeBtn.onclick = () => {
                filesToUpload.splice(index, 1);
                updatePreview();
            };
            div.appendChild(removeBtn);

            preview.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

uploadBtn.addEventListener('click', async () => {
    uploadBtn.disabled = true;
    let uploaded = 0;
    const totalFiles = filesToUpload.length;

    for (const file of filesToUpload) {
        const formData = new FormData();
        formData.append('file', file);

        const totalSize = file.size;
        let loaded = 0;

        const simulateProgress = setInterval(() => {
            loaded += totalSize / 10; // Simulate upload speed
            const percentComplete = (loaded / totalSize) * 100 / totalFiles + (uploaded / totalFiles) * 100;
            progressBar.style.width = `${Math.min(percentComplete, 100)}%`;
            progressBar.textContent = `${Math.round(Math.min(percentComplete, 99))}%`; // Cap at 99% until success
            if (loaded >= totalSize) clearInterval(simulateProgress);
        }, 200);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }

            const result = await response.json();
            uploaded++;
            if (uploaded === totalFiles) {
                progressBar.style.width = '100%';
                progressBar.textContent = '100%';
                successMessage.style.display = 'block';
                setTimeout(() => {
                    successMessage.style.display = 'none';
                }, 5000); // Hide after 5 seconds
            }
        } catch (err) {
            console.error('Upload error:', err);
            clearInterval(simulateProgress);
            alert('Error uploading file: ' + file.name);
            uploadBtn.disabled = false;
            return;
        }
    }

    filesToUpload = [];
    preview.innerHTML = '';
    uploadBtn.disabled = true;
    progressBar.style.width = '0%';
});