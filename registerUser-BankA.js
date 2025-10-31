'use strict';
const fs = require('fs');
const path = require('path');
const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');

const CCP_FILE    = 'connection-banka.json';
const MSP_ID      = 'BankAMSP';
const WALLET      = 'wallet-BankA';
const ADMIN_ID    = 'admin';
const USER_ID     = 'user1';                // change if needed
const AFFILIATION = 'banka.department1';    // remove if not using affiliations

async function main() {
  try {
    const ccpPath = path.resolve(__dirname, CCP_FILE);
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

    const [caKey] = Object.keys(ccp.certificateAuthorities);
    const caInfo = ccp.certificateAuthorities[caKey];

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

    if (await wallet.get(USER_ID)) {
      console.log(`Identity "${USER_ID}" already exists in ${WALLET}`);
      return;
    }

    const adminIdentity = await wallet.get(ADMIN_ID);
    if (!adminIdentity) throw new Error(`Admin identity "${ADMIN_ID}" not found in ${WALLET}. Enroll admin first.`);

    const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
    const adminUser = await provider.getUserContext(adminIdentity, ADMIN_ID);

    // Ensure affiliation exists (ignore error if already present)
    if (AFFILIATION) {
      try { await ca.newAffiliationService().create({ name: AFFILIATION, force: true }, adminUser); } catch (_) {}
    }

    const secret = await ca.register({ affiliation: AFFILIATION, enrollmentID: USER_ID, role: 'client' }, adminUser);
    const enrollment = await ca.enroll({ enrollmentID: USER_ID, enrollmentSecret: secret });

    const x509Identity = {
      credentials: { certificate: enrollment.certificate, privateKey: enrollment.key.toBytes() },
      mspId: MSP_ID,
      type: 'X.509',
    };
    await wallet.put(USER_ID, x509Identity);
    console.log(`✅ Registered & enrolled "${USER_ID}" into ${WALLET}`);
  } catch (e) {
    console.error('❌ Register/enroll failed:', e.message);
    process.exit(1);
  }
}
main();
