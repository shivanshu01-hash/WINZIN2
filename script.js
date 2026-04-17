document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.querySelector('#username').value;
        const password = document.querySelector('#password').value;

        // Hide error message initially
        errorMessage.style.display = 'none';

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                // Login successful, redirect to dashboard or show success message
                // For demonstration, redirecting back to index or another valid route.
                // Replace '/dashboard' with the valid route if available.
                window.location.href = '/dashboard';
            } else {
                // Login failed, show error message
                errorMessage.textContent = 'Invalid username or password';
                errorMessage.style.display = 'block';
            }
        } catch (error) {
            console.error(error);
            errorMessage.textContent = 'An error occurred. Please try again.';
            errorMessage.style.display = 'block';
        }
    });

    // Add glowing effect logic to inputs via JS (smooth transition already in CSS)
    const inputs = document.querySelectorAll('.input-group input');
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            input.parentElement.style.borderColor = '#8ab4f8';
            input.parentElement.style.boxShadow = '0 0 0 3px rgba(138, 180, 248, 0.3)';
        });
        input.addEventListener('blur', () => {
            input.parentElement.style.borderColor = '#ced4da';
            input.parentElement.style.boxShadow = 'none';
        });
    });
});
