// Try to import web-vitals directly to see what's available
import * as webVitals from 'web-vitals';
console.log('Available exports from web-vitals:', Object.keys(webVitals));

const reportWebVitals = (onPerfEntry?: (metric: any) => void) => {
  console.log('reportWebVitals called with:', onPerfEntry);
  if (onPerfEntry && onPerfEntry instanceof Function) {
    console.log('Attempting to import web-vitals dynamically...');
    import('web-vitals').then((module) => {
      console.log('Dynamic import successful, available exports:', Object.keys(module));
      if (module.getCLS) {
        console.log('Calling getCLS...');
        module.getCLS(onPerfEntry);
      }
      if (module.getFID) {
        console.log('Calling getFID...');
        module.getFID(onPerfEntry);
      }
      if (module.getFCP) {
        console.log('Calling getFCP...');
        module.getFCP(onPerfEntry);
      }
      if (module.getLCP) {
        console.log('Calling getLCP...');
        module.getLCP(onPerfEntry);
      }
      if (module.getTTFB) {
        console.log('Calling getTTFB...');
        module.getTTFB(onPerfEntry);
      }
    }).catch((error) => {
      console.error('Error importing web-vitals:', error);
    });
  }
};

export default reportWebVitals;
