'use strict';
const fs = require('fs');
const path = require('path');
const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');

const CCP_FILE = 'connection-banka.json';
const MSP_ID   = 'BankAMSP';
const WALLET   = 'wallet-BankA';
const ADMIN_ID = 'admin';
const ADMIN_PW = 'adminpw';

async function main() {
  try {
    const ccpPath = path.resolve(__dirname, CCP_FILE);
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

    const [caKey] = Object.keys(ccp.certificateAuthorities);
    const caInfo = ccp.certificateAuthorities[caKey];

    // TLS roots (optional if your CA runs without TLS)
    let trustedRoots = '';
    if (caInfo.tlsCACerts) {
      if (caInfo.tlsCACerts.pem) {
        trustedRoots = Array.isArray(caInfo.tlsCACerts.pem) ? caInfo.tlsCACerts.pem.join('\n') : caInfo.tlsCACerts.pem;
      } else if (caInfo.tlsCACerts.path) {
        const pemPath = path.resolve(__dirname, caInfo.tlsCACerts.path);
        trustedRoots = fs.existsSync(pemPath) ? fs.readFileSync(pemPath, 'utf8') : '';
      }
    }

    const ca = new FabricCAServices(caInfo.url, { trustedRoots, verify: !!trustedRoots }, caInfo.caName);

    const wallet = await Wallets.newFileSystemWallet(path.join(process.cwd(), WALLET));
    if (await wallet.get(ADMIN_ID)) {
      console.log(`Identity "${ADMIN_ID}" already exists in ${WALLET}`);
      return;
    }

    const enrollment = await ca.enroll({ enrollmentID: ADMIN_ID, enrollmentSecret: ADMIN_PW });
    const x509Identity = {
      credentials: { certificate: enrollment.certificate, privateKey: enrollment.key.toBytes() },
      mspId: MSP_ID,
      type: 'X.509',
    };
    await wallet.put(ADMIN_ID, x509Identity);
    console.log(`✅ Enrolled admin "${ADMIN_ID}" into ${WALLET}`);
  } catch (e) {
    console.error('❌ Enroll failed:', e.message);
    process.exit(1);
  }
}
main();
