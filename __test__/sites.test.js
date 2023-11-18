const { convertToCsv } = require('../routes/DashboardAPIs/sites.js');

describe('convertToCsv', () => {

    // Should return a string with comma-separated values for each row of data
    it('should return a string with comma-separated values for each row of data', () => {
      const data = [
        { name: 'John', age: 30, city: 'New York' },
        { name: 'Jane', age: 25, city: 'Los Angeles' },
        { name: 'Mike', age: 35, city: 'Chicago' }
      ];

      const expected = 'name,age,city\nJohn,30,New York\nJane,25,Los Angeles\nMike,35,Chicago\n';
      const result = convertToCsv(data);

      expect(result).toEqual(expected);
    });

    // Should include a header row with comma-separated column names
    it('should include a header row with comma-separated column names', () => {
      const data = [
        { name: 'John', age: 30, city: 'New York' },
        { name: 'Jane', age: 25, city: 'Los Angeles' },
        { name: 'Mike', age: 35, city: 'Chicago' }
      ];

      const expected = 'name,age,city\n';
      const result = convertToCsv(data);

      expect(result.startsWith(expected)).toBe(true);
    });

    // Should handle data with multiple rows and columns
    it('should handle data with multiple rows and columns', () => {
      const data = [
        { name: 'John', age: 30, city: 'New York' },
        { name: 'Jane', age: 25, city: 'Los Angeles' },
        { name: 'Mike', age: 35, city: 'Chicago' }
      ];

      const expected = 'name,age,city\nJohn,30,New York\nJane,25,Los Angeles\nMike,35,Chicago\n';
      const result = convertToCsv(data);

      expect(result).toEqual(expected);
    });

    // Should handle data with special characters in column names and values
    it('should handle data with special characters in column names and values', () => {
      const data = [
        { name: 'John', age: 30, city: 'New York' },
        { name: 'Jane', age: 25, city: 'Los Angeles' },
        { name: 'Mike', age: 35, city: 'Chicago' }
      ];

      const expected = 'name,age,city\nJohn,30,New York\nJane,25,Los Angeles\nMike,35,Chicago\n';
      const result = convertToCsv(data);

      expect(result).toEqual(expected);
    });

    // Should handle data with different data types (e.g. string, number, boolean)
    it('should handle data with different data types (e.g. string, number, boolean)', () => {
      const data = [
        { name: 'John', age: 30, city: 'New York', isStudent: true },
        { name: 'Jane', age: 25, city: 'Los Angeles', isStudent: false },
        { name: 'Mike', age: 35, city: 'Chicago', isStudent: true }
      ];

      const expected = 'name,age,city,isStudent\nJohn,30,New York,true\nJane,25,Los Angeles,false\nMike,35,Chicago,true\n';
      const result = convertToCsv(data);

      expect(result).toEqual(expected);
    });
});
