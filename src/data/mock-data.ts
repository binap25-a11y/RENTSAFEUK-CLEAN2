export const recentActivities = [
    { id: 1, property: '123 Oakhaven St', activity: 'New maintenance request logged', date: '2 days ago' },
    { id: 2, property: '456 Maple Rd', activity: 'Tenant communication recorded', date: '3 days ago' },
    { id: 3, property: '789 Pine Ln', activity: 'Inspection report uploaded', date: '5 days ago' },
    { id: 4, property: '123 Oakhaven St', activity: 'Maintenance status updated to "In Progress"', date: '1 week ago' },
];

export const upcomingTasks = [
    { id: 1, task: 'Quarterly Inspection', property: '123 Oakhaven St', status: 'Scheduled', dueDate: '2024-08-15' },
    { id: 2, task: 'Fix Leaky Faucet', property: '456 Maple Rd', status: 'Pending', dueDate: '2024-08-10' },
    { id: 3, task: 'Gas Safety Certificate', property: '789 Pine Ln', status: 'Due', dueDate: '2024-08-20' },
    { id: 4, task: 'Garden Tidy Up', property: '123 Oakhaven St', status: 'Scheduled', dueDate: '2024-09-01' },
];

export const documents = [
  { id: 1, title: 'Gas Safety Certificate 2023', property: '123 Oakhaven St', type: 'Gas Safety Certificate', status: 'Expired', expiryDate: '2024-06-01' },
  { id: 2, title: 'Tenancy Agreement - J. Doe', property: '456 Maple Rd', type: 'Tenancy Agreement', status: 'Valid', expiryDate: '2025-01-31' },
  { id: 3, title: 'EICR Report', property: '123 Oakhaven St', type: 'Electrical Certificate', status: 'Expiring Soon', expiryDate: '2024-09-15' },
  { id: 4, title: 'EPC Certificate', property: '789 Pine Ln', type: 'EPC', status: 'Valid', expiryDate: '2028-05-20' },
  { id: 5, title: 'Deposit Protection Certificate', property: '456 Maple Rd', type: 'Deposit Protection', status: 'Valid', expiryDate: '2025-02-10' },
];

export const properties = [
  {
    id: '1',
    address: '123 Oakhaven St, London, W1A 1AA',
    propertyType: 'Flat',
    status: 'Occupied',
    bedrooms: 2,
    bathrooms: 1,
    imageUrl: 'https://picsum.photos/seed/prop1/800/500',
    tenant: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '07123 456789',
    },
    tenancy: {
      startDate: '2023-08-01',
      endDate: '2024-07-31',
    },
    location: {
        lat: 51.5156,
        lng: -0.1419,
    }
  },
  {
    id: '2',
    address: '456 Maple Rd, Manchester, M1 1AA',
    propertyType: 'House',
    status: 'Vacant',
    bedrooms: 3,
    bathrooms: 2,
    imageUrl: 'https://picsum.photos/seed/prop2/800/500',
    tenant: null,
    tenancy: null,
    location: {
        lat: 53.4808,
        lng: -2.2426,
    }
  },
  {
    id: '3',
    address: '789 Pine Ln, Bristol, BS1 1AA',
    propertyType: 'Studio',
    status: 'Occupied',
    bedrooms: 1,
    bathrooms: 1,
    imageUrl: 'https://picsum.photos/seed/prop3/800/500',
    tenant: {
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      phone: '07987 654321',
    },
    tenancy: {
      startDate: '2024-01-15',
      endDate: '2025-01-14',
    },
    location: {
        lat: 51.4545,
        lng: -2.5879,
    }
  }
];

export const expenses = [
    { id: 1, property: '123 Oakhaven St, London, W1A 1AA', date: '2024-07-01', type: 'Repairs and Maintenance', paidBy: 'Landlord', amount: 150.00, notes: 'Fix leaky pipe in kitchen.' },
    { id: 2, property: '456 Maple Rd, Manchester, M1 1AA', date: '2024-07-05', type: 'Letting Agent Fees', paidBy: 'Landlord', amount: 300.00, notes: 'Management fee for July.' },
    { id: 3, property: '123 Oakhaven St, London, W1A 1AA', date: '2024-07-10', type: 'Insurance', paidBy: 'Landlord', amount: 45.50, notes: 'Monthly building insurance.' },
];

export const annualSummary = {
    year: 2024,
    totalRentalIncome: 12000,
    notes: 'Consider redecorating the main bedroom next year. Look into getting a better deal on insurance.',
};

export const rentStatement = [
    { month: 'January', rent: 1000, paid: true, notes: '' },
    { month: 'February', rent: 1000, paid: true, notes: '' },
    { month: 'March', rent: 1000, paid: true, notes: '' },
    { month: 'April', rent: 1000, paid: true, notes: '' },
    { month: 'May', rent: 1000, paid: true, notes: 'Tenant paid 5 days late.' },
    { month: 'June', rent: 1000, paid: true, notes: '' },
    { month: 'July', rent: 1000, paid: true, notes: '' },
    { month: 'August', rent: 1000, paid: false, notes: 'Pending' },
];
