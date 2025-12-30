document.getElementById('noteForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const note = document.getElementById('note').value;
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!note) {
        alert('Please enter a name for the file.');
        return;
    }

    if (!file) {
        alert('Please select a file to upload.');
        return;
    }

    const formData = new FormData();
    formData.append('note', note);
    formData.append('file', file);

    const response = await fetch('/upload', {
        method: 'POST',
        body: formData
    });

    if (response.ok) {
        alert('File uploaded successfully!');
        document.getElementById('note').value = '';
        document.getElementById('fileInput').value = '';
        loadFiles();
    } else {
        alert('Failed to upload file.');
    }
});

async function loadFiles() {
    const response = await fetch('/files');
    const files = await response.json();

    const notesList = document.getElementById('notesList');
    notesList.innerHTML = '';

    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Name</th>
                <th>File Key</th>
                <th>Action</th>
            </tr>
        </thead>
        <tbody>
        </tbody>
    `;
    files.forEach(file => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${file.name}</td>
            <td>${file.key}</td>
            <td><button onclick="deleteFile('${file.key}')">Delete</button></td>
        `;
        table.querySelector('tbody').appendChild(row);
    });

    notesList.appendChild(table);
}

async function deleteFile(fileKey) {
    const response = await fetch(`/files/${fileKey}`, {
        method: 'DELETE',
    });

    if (response.ok) {
        alert('File deleted successfully!');
        loadFiles();
    } else {
        alert('Failed to delete file.');
    }
}

document.addEventListener('DOMContentLoaded', loadFiles);

// Theme Toggle Functionality
const themeToggle = document.getElementById('themeToggle');
const currentTheme = localStorage.getItem('theme') || 'light';

document.documentElement.setAttribute('data-theme', currentTheme);
if (currentTheme === 'dark') {
    themeToggle.checked = true;
}

themeToggle.addEventListener('change', function() {
    const theme = themeToggle.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
});
