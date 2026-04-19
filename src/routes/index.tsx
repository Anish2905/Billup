/**
 * Route definitions
 */


import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { InvoiceList } from '../features/invoices/InvoiceList';
import { InvoiceEditor } from '../features/invoices/InvoiceEditor';
import { PartyList } from '../features/parties/PartyList';
import { ItemList } from '../features/items/ItemList';
import { Reports } from '../features/reports/Reports';
import { Settings } from '../features/settings/Settings';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/invoices" replace /> },
      { path: 'invoices', element: <InvoiceList /> },
      { path: 'invoices/new', element: <InvoiceEditor /> },
      { path: 'invoices/:id', element: <InvoiceEditor /> },
      { path: 'parties', element: <PartyList /> },
      { path: 'items', element: <ItemList /> },
      { path: 'reports', element: <Reports /> },
      { path: 'reports/:tab', element: <Reports /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
]);
