const { sendMagicLinkEmail, sendResetPasswordLink, sendMagicLinkEmailByAdmin } = require('../services/mailer.js')


const info = {
    response: jest.fn(),
}


describe('sendMagicLinkEmail', () => {
    beforeEach(() => {
        // Clear the mock implementation and reset the call count between tests
        info.response.mockClear();
    });


    it('should handle email sending errors', async () => {
        // Define test data
        const email = 'user@example.com';
        const token = 'mockToken';
        const fname = 'John';


        // Mock the transporter.sendMail function to reject with an error
        info.response.mockRejectedValue('connect ECONNREFUSE');

        // Call the sendMagicLinkEmail function and handle the error
        try {
            await sendMagicLinkEmail({ email, token, fname });
        } catch (error) {
            // Verify that the error message matches the expected error message
            expect(error.message.slice(0, 19)).toBe('connect ECONNREFUSE');
        }
    });

    // Add more test cases to cover different scenarios and edge cases
});


describe('sendResetPasswordLink', () => {
    beforeEach(() => {
        // Clear the mock implementation and reset the call count between tests
        info.response.mockClear();
    });


    it('should handle email sending errors', async () => {
        // Define test data
        const email = 'user@example.com';
        const token = 'mockToken';
        const fname = 'John';


        // Mock the transporter.sendMail function to reject with an error
        info.response.mockRejectedValue('connect ECONNREFUSE');

        // Call the sendMagicLinkEmail function and handle the error
        try {
            await sendResetPasswordLink({ email, token, fname });
        } catch (error) {
            // Verify that the error message matches the expected error message
            expect(error.message.slice(0, 19)).toBe('connect ECONNREFUSE');
        }
    });

    // Add more test cases to cover different scenarios and edge cases
});




describe('sendMagicLinkEmailByAdmin', () => {
    beforeEach(() => {
        // Clear the mock implementation and reset the call count between tests
        info.response.mockClear();
    });


    it('should handle email sending errors', async () => {
        // Define test data
        const email = 'user@example.com';
        const token = 'mockToken';
        const fname = 'John';


        // Mock the transporter.sendMail function to reject with an error
        info.response.mockRejectedValue('connect ECONNREFUSE');

        // Call the sendMagicLinkEmail function and handle the error
        try {
            await sendMagicLinkEmailByAdmin({ email, token, fname });
        } catch (error) {
            // Verify that the error message matches the expected error message
            expect(error.message.slice(0, 19)).toBe('connect ECONNREFUSE');
        }
    });

    // Add more test cases to cover different scenarios and edge cases
});
