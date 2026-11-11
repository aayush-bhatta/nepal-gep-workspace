import React from 'react';
import {createRoot} from 'react-dom/client';
import {FileWorkspace} from '../src/FileWorkspace';
import '../src/style.css';
createRoot(document.getElementById('root')!).render(<FileWorkspace role="owner"/>);
