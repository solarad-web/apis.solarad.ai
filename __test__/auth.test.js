const { generateHash } = require('../routes/DashboardAPIs/auth.js');

describe('generateHash', () => {

    // Generates a hash value for a given password.
    it('should generate a hash value for a given password', async () => {
      // Arrange
      const password = 'password123';

      // Act
      const hash = await generateHash(password);

      // Assert
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });


    // Returns the hashed password.
    it('should return the hashed password', async () => {
      // Arrange
      const password = 'password123';

      // Act
      const hash = await generateHash(password);

      // Assert
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    // Throws an error if password is null or undefined.
    it('should throw an error if password is null or undefined', async () => {
      // Arrange
      const password = null;

      // Act and Assert
      await expect(generateHash(password)).rejects.toThrow();
    });

    // Does not throw an error if password is an empty string.
    it('should not throw an error if password is an empty string', async () => {
      // Arrange
      const password = '';

      // Act and Assert
      await expect(generateHash(password)).resolves.not.toThrow();
    });
});
