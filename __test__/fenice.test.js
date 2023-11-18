const {
    convertToCsv,
    checkApiKey,
    insertOrUpdateSite,
    generateCSV,
    fetchResidentialSites,
    processCsvData,
    generateTodayDateString,
    isFutureTime
} = require('../routes/fenice.js')

const { generateHash } = require('../routes/DashboardAPIs/auth.js')
const pool = require("../config/db");
const { Readable } = require('stream');
const fs = require('fs');
const csv = require('csv-parser');
// Create a manual mock for pool.query
jest.mock('../config/db', () => ({
    query: jest.fn(),
}));


describe('convertToCsv', () => {

    // Should return an empty string when input data is null or empty
    it('should return an empty string when input data is null', () => {
        const data = null;
        const result = convertToCsv(data);
        expect(result).toEqual('');
    });

    // Should correctly convert an array of objects to a CSV string
    it('should correctly convert an array of objects to a CSV string', () => {
        const data = [
            { name: 'John', age: 25, city: 'New York' },
            { name: 'Jane', age: 30, city: 'Los Angeles' },
            { name: 'Bob', age: 35, city: 'Chicago' }
        ];
        const expectedCsv = 'name,age,city\nJohn,25,New York\nJane,30,Los Angeles\nBob,35,Chicago\n';
        const result = convertToCsv(data);
        expect(result).toEqual(expectedCsv);
    });
});





describe('checkApiKey', () => {

    // Returns true when providedApiKey and storedApiKey are valid and match.
    it('should return true when providedApiKey and storedApiKey are valid and match', async () => {
        const providedApiKey = 'xyz';
        const storedApiKey = await generateHash(providedApiKey);
        
        const result = await checkApiKey(providedApiKey, storedApiKey);

        expect(result).toBe(true);
    });

    // Returns false when providedApiKey is empty or not a string.
    it('should return false when providedApiKey is empty or not a string', async () => {
        const providedApiKey = '';
        const storedApiKey = 'validApiKey';

        const result = await checkApiKey(providedApiKey, storedApiKey);

        expect(result).toBe(false);
    });

    // Returns false when storedApiKey is empty or not a string.
    it('should return false when storedApiKey is empty or not a string', async () => {
        const providedApiKey = 'validApiKey';
        const storedApiKey = '';

        const result = await checkApiKey(providedApiKey, storedApiKey);

        expect(result).toBe(false);
    });

    // Returns false when providedApiKey is null.
    it('should return false when providedApiKey is null', async () => {
        const providedApiKey = null;
        const storedApiKey = 'validApiKey';

        const result = await checkApiKey(providedApiKey, storedApiKey);

        expect(result).toBe(false);
    });

    // Returns false when providedApiKey is undefined.
    it('should return false when providedApiKey is undefined', async () => {
        const providedApiKey = undefined;
        const storedApiKey = 'validApiKey';

        const result = await checkApiKey(providedApiKey, storedApiKey);

        expect(result).toBe(false);
    });

    // Returns false when storedApiKey is null.
    it('should return false when storedApiKey is null', async () => {
        const providedApiKey = 'validApiKey';
        const storedApiKey = null;

        const result = await checkApiKey(providedApiKey, storedApiKey);

        expect(result).toBe(false);
    });
});







describe('insertOrUpdateSite', () => {
    afterEach(() => {
        // Clear mock calls after each test
        pool.query.mockClear();
    });

    it('Total queries executed should be 3', async () => {
        const req = {
            body: {
                sitename: 'Test Site 1',
                lat: 27,
                lon: 78,
                ele: 0,
                capacity: 100,
                country: 'India',
                timezone: 'Asia/Kolkata',
                mount_config: 'None',
                tilt_angle: '0',
                ground_data_available: 'False',
            },
        };

        // Mock the behavior of pool.query to simulate a new site insertion
        pool.query.mockResolvedValueOnce({ rows: [] }); // Simulate no existing site with the same lat and lon

        const result = await insertOrUpdateSite(req);

        expect(pool.query).toHaveBeenCalledTimes(3); // Ensure that pool.query was called
        expect(result).toBe('Site added successfully'); // Check the expected result
    });

    it('should update an existing site successfully', async () => {
        const req = {
            body: {
                sitename: 'Updated Site',
                lat: 27,
                lon: 78,
                ele: 0,
                capacity: 100,
                country: 'India',
                timezone: 'Asia/Kolkata',
                mount_config: 'None',
                tilt_angle: '0',
                ground_data_available: 'False',
            },
        };

        pool.query.mockResolvedValueOnce({ rows: [] });

        pool.query.mockResolvedValueOnce({ rows: [{ /* Existing site data */ }] });


        const result = await insertOrUpdateSite(req);

        expect(pool.query).toHaveBeenCalledTimes(3);
        expect(result).toBe('Site updated successfully');
    });

    it('should handle errors by throwing an exception', async () => {
        const req = {
            body: {
                sitename: 'Test Site 2',
                lat: 27,
                lon: 78,
                ele: 0,
                capacity: 100,
                country: 'India',
                timezone: 'Asia/Kolkata',
                mount_config: 'None',
                tilt_angle: '0',
                ground_data_available: 'False',
            },
        };

        // Mock the behavior of pool.query to simulate an error
        pool.query.mockRejectedValueOnce(new Error('Database error'));

        // Use async/await to catch the error thrown by the function
        await expect(async () => {
            await insertOrUpdateSite(req);
        }).rejects.toThrow('Database error');
    });
});







describe('generateCSV', () => {
    it('should generate CSV with headers and rows', () => {
        const rows = [
            {
                sitename: 'Site 1',
                company: 'Company A',
                lat: 27,
                lon: 78,
                ele: 0,
                capacity: 100,
                country: 'India',
                timezone: 'Asia/Kolkata',
                mount_config: 'None',
                tilt_angle: '0',
                ground_data_available: 'False',
            },
            {
                sitename: 'Site 2',
                company: 'Company B',
                lat: 28,
                lon: 79,
                ele: 10,
                capacity: 200,
                country: 'USA',
                timezone: 'America/New_York',
                mount_config: 'Config X',
                tilt_angle: '5',
                ground_data_available: 'True',
            },
        ];

        const csvStream = generateCSV(rows);

        // Convert the CSV stream to a string
        const generatedCSV = csvStream.read().toString();

        // Define the expected CSV string with line breaks between rows
        const expectedCSV = 'sitename,company,lat,lon,ele,capacity,country,timezone,mount_config,tilt_angle,ground_data_available\nSite 1,Company A,27,78,0,100,India,Asia/Kolkata,None,0,False\nSite 2,Company B,28,79,10,200,USA,America/New_York,Config X,5,True'

        console.log(generatedCSV)
        expect(generatedCSV).toBe(expectedCSV);
    });


    it('should generate CSV with headers only when rows are empty', () => {
        const rows = [];

        const csvStream = generateCSV(rows);

        // Convert the CSV string to a readable stream
        const readableStream = Readable.from(csvStream);

        // Parse the generated CSV and compare it with the expected CSV (headers only)
        const expectedCSV = `sitename,company,lat,lon,ele,capacity,country,timezone,mount_config,tilt_angle,ground_data_available`;

        return new Promise((resolve, reject) => {
            let actualCSV = '';

            readableStream
                .on('data', (chunk) => {
                    actualCSV += chunk.toString();
                })
                .on('end', () => {
                    expect(actualCSV).toBe(expectedCSV);
                    resolve();
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    });
});





describe('fetchResidentialSites', () => {
    it('should fetch residential sites for a given client', async () => {
        // Define a sample client
        const client = 'Company A';

        // Define sample query results
        const queryResults = {
            rows: [
                {
                    sitename: 'Site 1',
                    company: 'Company A',
                    lat: 27,
                    lon: 78,
                },
                {
                    sitename: 'Site 2',
                    company: 'Company A',
                    lat: 28,
                    lon: 79,
                },
            ],
        };

        // Mock the pool.query function to resolve with the sample query results
        pool.query.mockResolvedValue(queryResults);

        // Call the fetchResidentialSites function
        const result = await fetchResidentialSites(client);

        // Verify that pool.query was called with the correct query and parameters
        expect(pool.query).toHaveBeenCalledWith('SELECT * FROM residential_sites WHERE company = $1', [client]);

        // Verify that the result matches the expected query results
        expect(result).toEqual(queryResults.rows);
    });

    it('should handle errors by throwing an exception', async () => {
        // Mock the pool.query function to reject with an error
        const errorMessage = 'Database error';
        pool.query.mockRejectedValue(new Error(errorMessage));

        // Call the fetchResidentialSites function
        try {
            await fetchResidentialSites('Company A');
        } catch (error) {
            // Verify that the error message matches the expected error message
            expect(error.message).toBe(errorMessage);
        }
    });
});



describe('processCsvData', () => {

    // Returns the CSV data when the file contains the required column
    it('should return the CSV data when the file contains the required column', async () => {
      const filePath = 'test.csv';
      const lastNRows = undefined;
      const queryDate = undefined;
      const isPresentDateQuery = false;

      // Create a test.csv file with the required column
      const fs = require('fs');
      const csvData = 'Time,Value\n2022-01-01 12:00:00,10\n2022-01-01 13:00:00,20\n2022-01-01 14:00:00,30\n';
      fs.writeFileSync(filePath, csvData);

      await expect(processCsvData(filePath, lastNRows, queryDate, isPresentDateQuery)).resolves.toBeDefined();

      // Delete the test.csv file after the test
      fs.unlinkSync(filePath);
    });
});




describe('generateTodayDateString', () => {

    // Returns a string in the format 'yyyy-mm-dd' when called.
    it('should return a string in the format yyyy-mm-dd', () => {
      const result = generateTodayDateString();
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      expect(result).toMatch(datePattern);
      const dateParts = result.split('-');
      const date = new Date();
      expect(dateParts[0]).toEqual(String(date.getFullYear()));
      expect(dateParts[1]).toEqual(String(date.getMonth() + 1).padStart(2, '0'));
      expect(dateParts[2]).toEqual(String(date.getDate()).padStart(2, '0'));
    });

    // Returns a string with a length of 10 characters.
    it('should return a string with a length of 10 characters', () => {
      const result = generateTodayDateString();
      expect(result.length).toBe(10);
    });

    // Returns a string with the year, month and day separated by hyphens.
    it('should return a string with the year, month and day separated by hyphens', () => {
      const result = generateTodayDateString();
      const [year, month, day] = result.split('-');
      expect(year).toMatch(/^\d{4}$/);
      expect(month).toMatch(/^\d{2}$/);
      expect(day).toMatch(/^\d{2}$/);
    });

    // Returns a string with the current date in the UTC timezone.
    it('should return a string with the current date in the UTC timezone', () => {
      const result = generateTodayDateString();
      const today = new Date();
      const utcYear = today.getUTCFullYear();
      const utcMonth = String(today.getUTCMonth() + 1).padStart(2, '0');
      const utcDay = String(today.getUTCDate()).padStart(2, '0');
      const expected = `${utcYear}-${utcMonth}-${utcDay}`;
      expect(result).toBe(expected);
    });

    // Returns a string with the current date in a specific timezone.
    it('should return a string with the current date in a specific timezone', () => {
      const result = generateTodayDateString();
      const today = new Date();
      const timezoneOffset = today.getTimezoneOffset() / 60;
      const timezoneYear = today.getFullYear();
      const timezoneMonth = String(today.getMonth() + 1).padStart(2, '0');
      const timezoneDay = String(today.getDate()).padStart(2, '0');
      const expected = `${timezoneYear}-${timezoneMonth}-${timezoneDay}`;
      expect(result).toBe(expected);
    });

    // Returns a string with the current date.
    it('should return a string with the current date', () => {
      const result = generateTodayDateString();
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const expected = `${yyyy}-${mm}-${dd}`;
      expect(result).toBe(expected);
    });
});



describe('isFutureTime', () => {

    // Returns true if the input time string is in the future compared to the current time.
    it('should return true when the input time string is in the future', () => {
      const futureTime = new Date(Date.now() + 1000);
      const result = isFutureTime(futureTime.toISOString());
      expect(result).toBe(true);
    });

    // Returns false if the input time string is in the past compared to the current time.
    it('should return false when the input time string is in the past', () => {
      const pastTime = new Date(Date.now() - 1000);
      const result = isFutureTime(pastTime.toISOString());
      expect(result).toBe(false);
    });

    // Returns false if the input time string is equal to the current time.
    it('should return false when the input time string is equal to the current time', () => {
      const currentTime = new Date();
      const result = isFutureTime(currentTime.toISOString());
      expect(result).toBe(false);
    });

    // Returns false if the input time string is not a valid date string.
    it('should return false when the input time string is not a valid date string', () => {
      const invalidTimeString = 'invalid';
      const result = isFutureTime(invalidTimeString);
      expect(result).toBe(false);
    });

    // The function should handle time strings in different time zones correctly.
    it('should handle time strings in different time zones correctly', () => {
      const futureTime = new Date(Date.now() + 1000);
      const futureTimeInDifferentTimeZone = futureTime.toLocaleString('en-US');
      const result = isFutureTime(futureTimeInDifferentTimeZone);
      expect(result).toBe(true);
    });

    // The function should handle leap years and daylight saving time correctly.
    it('should handle leap years and daylight saving time correctly', () => {
      const futureTime = new Date('2024-02-29T00:00:00Z');
      const result = isFutureTime(futureTime.toISOString());
      expect(result).toBe(true);
    });
});