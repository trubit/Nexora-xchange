import { Container, Row, Col } from "react-bootstrap";
import NewsletterSection from "../Components/home/NewsletterSection";
import NavigationSection from "../Components/layout/NavigationSection";
import BottomBar from "../Components/layout/BottomBar";
import "../styles/UserAgreement.css";

const brandize = (text) =>
  text
    .replace(/XCHANGEON/g, "NEXORA")
    .replace(/XchangeOn/g, "Nexora");

const UserAgreement = () => {
  return (
    <>
      <section className="user-agreement-page">
        <Container className="user-agreement-wrap">
          <Row className="justify-content-center">
            <Col xs={12}>
              <article className="user-agreement-card">
                <h1 className="user-agreement-title">User Agreement</h1>

                <p className="agreement-intro">
                  This User Agreement (&ldquo;Agreement&rdquo; or &ldquo;Terms&rdquo;) is a legally binding contract between you (&ldquo;User,&rdquo; &ldquo;you,&rdquo; or &ldquo;your&rdquo;) and Nexora FZCO, a limited liability company incorporated in, and operating under laws of the Emirate of Dubai, the rules and regulations of the Dubai World Trade Centre (DWTC), and the applicable laws and regulations of the United Arab Emirates (UAE), with its registered office address at CVT-FLR05-05.10, Convention Centre, DWTC, Dubai, UAE (&ldquo;Nexora,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), governing your access to and use of all services made available through our website (https://www.xchangeon.io), APIs, mobile applications, or any other sites and/or platforms (collectively, the &ldquo;Platform&rdquo;).
                </p>
                <p className="agreement-intro">
                  Nexora FZCO is duly licensed and regulated by the Dubai Virtual Assets Regulatory Authority (&quot;VARA&quot;) (License No.: XXXXXXXXXX), to provide Virtual Assets (VA) Exchange Services within and from the Emirate of Dubai, operating in full compliance with the Virtual Assets and Related Activities Regulations 2023, as may be amended from time to time (the &quot;VARA Regulations&quot;).
                </p>
                <p className="agreement-intro">
                  Under the VARA Regulations, &ldquo;Exchange Services&rdquo; refers to any of the following:
                </p>
                <ul className="agreement-intro-list">
                  <li>Conducting an exchange, trade or conversion between Virtual Assets and currency;</li>
                  <li>Conducting an exchange, trade or conversion between one or more Virtual Assets;</li>
                  <li>
                    Matching orders between buyers and sellers, and conducting an exchange, trade or conversion between:
                    <ul>
                      <li>Virtual Assets and currency</li>
                      <li>One or more Virtual Assets</li>
                    </ul>
                  </li>
                  <li>Maintaining an order book in furtherance of items (a), (b), or (c) above.</li>
                </ul>
                <p className="agreement-intro-link">
                  You may refer to VARA&rsquo;s Exchange Services Rulebook available at{" "}
                  <a
                    href="https://rulebooks.vara.io/rulebook/exchange-services-rulebook"
                    target="_blank"
                    rel="noreferrer"
                  >
                    https://rulebooks.vara.io/rulebook/exchange-services-rulebook
                  </a>{" "}
                  to learn more about VA Exchange Services.
                </p>
                <p className="agreement-intro">
                  Collectively, the VA Exchange Services we provide to you are referred to, in these Terms, as &ldquo;Nexora Services.&rdquo;
                </p>
                <p className="agreement-intro">
                  By creating an account, you must provide your full name, email address, and create a password. When presented with these Terms (and related policies such as the Privacy Policy, Electronic Communications Policy, Exchange Trading Rules, and any other terms or disclosures published on the Platform), click &ldquo;I Agree&rdquo; to confirm you have read, understood, and accepted all provisions. You will be recorded in our systems as the counterparty to these Terms.
                </p>

                <section className="agreement-section">
                  <h2>1. CHANGES TO THIS AGREEMENT</h2>
                  <p>{brandize("XchangeOn may amend these Terms by giving you at least 30 calendar days’ notice before changes take effect. If regulatory requirements compel a faster turnaround, changes may become effective in less than 30 days. You signify your acceptance of any amendment by clicking ‘I Agree’ on the updated Terms or by continuing to use the XchangeOn Services or Platform after the effective date. If you do not agree to the revised Terms, you must immediately cease using the XchangeOn Services and close your account.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>2. BINDING AGREEMENT</h2>
                  <p>{brandize("By using the Platform or any XchangeOn Service, you confirm you have read, understand, and agree to be bound by these Terms. If you do not agree, do not open an account or use any XchangeOn Services.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>3. SCHEDULES</h2>
                  <p>{brandize("The Risk Disclosure Statement, Fee Schedule, and Exchange Trading Rules (each published on the Platform) are incorporated by reference and form an integral part of this Agreement.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>4. NO INVESTMENT, TAX, OR LEGAL ADVICE</h2>
                  <p>{brandize("You acknowledge that XchangeOn does not provide investment, tax, or legal advice. All trading decisions, investment strategies, and other actions you take using the XchangeOn Services are made at your sole risk. While we may publish educational content or general information about virtual assets (on the Platform, social media, or other channels), such materials are for informational purposes only and should not be relied on.")}</p>
                  <p>{brandize("You agree not to hold XchangeOn (or any Group entity) liable for any decision or action you take based on the information or educational content we provide.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>5. NEXORA IS NOT A FIDUCIARY</h2>
                  <p>{brandize("XchangeOn does not act as your broker, trustee, or in any other fiduciary capacity. Every trade you execute is matched automatically by our order-matching engine based solely on the instructions you submit. Our relationship is limited to providing virtual asset exchange services as an independent technology platform operator. You retain full responsibility for all trading decisions, investment strategies, and portfolio management activities conducted through our platform.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>6. ELIGIBILITY</h2>
                  <p>{brandize("To open or maintain an XchangeOn account, you must be one of the following:")}</p>
                  <ul>
                    <li>{brandize("An individual opening an account for your own personal use; or")}</li>
                    <li>{brandize("A legal entity opening an account on its own behalf through its duly authorised representative.")}</li>
                  </ul>
                  <p>{brandize("1. Individuals: By registering as an individual, you represent and warrant that you:")}</p>
                  <ol>
                    <li>{brandize("Are a natural person at least eighteen (18) years old (or the age of majority in your jurisdiction).")}</li>
                    <li>{brandize("Have the legal capacity to accept and be bound by this Agreement.")}</li>
                    <li>{brandize("Reside in a jurisdiction where XchangeOn’s Services are officially offered.")}</li>
                    <li>{brandize("Are not located in, or attempting to access the Platform from, a Restricted Location (which currently includes, but is not limited to, the USA, Mainland China, Singapore, Canada, France, Germany, Hong Kong, Lithuania, Malaysia, Malta, Cuba, Iran, North Korea, Sudan, Syria, Crimea Region, Spain, Luhansk, Donetsk, Netherlands, and Bolivia, as well as any other jurisdiction XchangeOn designates over time).")}</li>
                    <li>{brandize("Are otherwise permitted by law to use the XchangeOn Services.")}</li>
                    <li>{brandize("Have never been convicted, sanctioned, or penalized by any government body for violations of applicable laws—such as AML/CFT, market-abuse, financial-crime, anti-corruption, or economic sanctions—and are not the target of any ongoing investigation or sanctions.")}</li>
                    <li>{brandize("Are the sole individual creating and controlling this XchangeOn account and will not permit anyone else to use your login credentials.")}</li>
                    <li>{brandize("Do not own any other personal account with XchangeOn.")}</li>
                    <li>{brandize("Have never been banned, suspended, or had your account closed by XchangeOn or any affiliated Group entity.")}</li>
                  </ol>
                  <p>{brandize("2. Legal Entities: If you are opening an account on behalf of a legal entity (including corporations, partnerships, funds, or other institutional entities), you further represent and warrant that:")}</p>
                  <ol>
                    <li>{brandize("The entity is validly organized and in good standing under its governing law.")}</li>
                    <li>{brandize("The entity is formed or resident in a jurisdiction where XchangeOn’s Services are offered.")}</li>
                    <li>{brandize("Neither the entity, its beneficial owners, nor any affiliate (each a ‘Represented Person’) is resident in or operating from a Restricted Location.")}</li>
                    <li>{brandize("You, the signatory, are duly authorized to bind the entity and all Represented Persons to this Agreement. References to ‘you’ in this section apply both to the individual signer and to the entity and its entire corporate group.")}</li>
                    <li>{brandize("Neither the entity nor any Represented Person is subject to sanctions imposed by any national or international authority.")}</li>
                    <li>{brandize("The entity and all Represented Persons have not previously been banned, suspended, or had an account closed by XchangeOn or any Group affiliate.")}</li>
                    <li>{brandize("No Represented Person maintains any other XchangeOn account.")}</li>
                  </ol>
                </section>

                <section className="agreement-section">
                  <h2>7. U.S. PERSONS &amp; REGULATORY COMPLIANCE</h2>
                  <p>{brandize("XchangeOn and its affiliates do not intend to provide Services to, or solicit, any ‘U.S. person’ or ‘U.S. customer’ as defined under United States law (including, but not limited to, SEC or CFTC regulations). You hereby certify the following:")}</p>
                  <ol>
                    <li>{brandize("Neither you nor any Represented Person is a ‘U.S. person’ or ‘U.S. customer’ under applicable U.S. rules (e.g., CFTC Regulation 4.7, SEC Rule 15a-6), nor do you act for or on behalf of any U.S. person.")}</li>
                    <li>{brandize("Neither you nor any Represented Person has been advised or induced—directly or indirectly—by XchangeOn or any Group entity to circumvent U.S. regulations.")}</li>
                    <li>{brandize("You have not advised or induced any Represented Person to do so.")}</li>
                    <li>{brandize("Neither you nor any Represented Person is a natural person domiciled in the United States, nor an entity formed under U.S. law, nor has its principal place of business in the United States.")}</li>
                    <li>{brandize("You affirm that you and any Represented Person are not subject to similar restrictions in any other jurisdiction that would prohibit use of XchangeOn.")}</li>
                    <li>{brandize("You will promptly notify XchangeOn if your status changes with respect to the above.")}</li>
                    <li>{brandize("You agree to indemnify, defend, and hold harmless XchangeOn and its affiliates, as well as their officers, directors, employees, agents, and service providers, from any claims, losses, liabilities, or expenses (including legal fees) arising from any breach of these U.S. person representations or from facilitating U.S.-person trading in violation of U.S. law.")}</li>
                  </ol>
                </section>

                <section className="agreement-section">
                  <h2>8. USER CLASSIFICATION &amp; SUITABILITY ASSESSMENT</h2>
                  <p>{brandize("XchangeOn may classify you as a ‘Retail Investor’ or ‘Institutional Investor’ as per the VARA regulations, both when you open an account and on an ongoing basis. We will review your classification at least once every 12 months. You must inform XchangeOn promptly of any change in your circumstances that may affect your classification.")}</p>
                  <p>{brandize("If, at any time, we determine (whether via periodic review, information you provide, or other means) that your classification should change, we may notify you in writing and reclassify your account accordingly.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>9. VERIFICATION &amp; RECORDKEEPING</h2>
                  <p>{brandize("When you open an account, you agree to provide accurate, complete information so we can verify your identity. If any information changes, you must update it immediately. See our Privacy Policy for details on how we process your data and your rights.")}</p>
                  <ol>
                    <li>{brandize("Identity Verification: During registration, you must supply (directly or via our third-party providers) all information needed to confirm your identity and comply with AML/CFT, fraud prevention, and other financial-crime regulations. Depending on our risk assessment, we may require additional documents. You must complete these verification steps before using any XchangeOn Services. At any time, based on the information we collect, we may modify your account’s access or limits.")}</li>
                    <li>
                      {brandize("Verification Information: To satisfy our VARA-mandated KYC/AML obligations, you must provide:")}
                      <ul>
                        <li>A unique username and secure password</li>
                        <li>A valid email address</li>
                        <li>Your country of residence</li>
                        <li>A government-issued photo ID showing your full name, date of birth, issuing country, and expiry date</li>
                        <li>Your physical residential address</li>
                      </ul>
                      <p>{brandize("If you are opening an institutional account, you must also provide:")}</p>
                      <ul>
                        <li>Identifying information for all beneficial owners or controlling persons (those who own or control over 10% of shares or voting rights), including names and birthdates</li>
                        <li>Corporate formation documents and proof of good standing</li>
                        <li>Written authorization confirming your authority to open and operate the account on behalf of the institution</li>
                      </ul>
                    </li>
                    <li>{brandize("Enhanced Due Diligence: XchangeOn may request additional information—such as source of funds, employment details, income information, or expected trading activity—before you can use (or continue to use) our Services. You agree to provide any such information promptly.")}</li>
                    <li>{brandize("Bank Account Information: If you fund your account via a bank transfer, you must provide your bank’s name, account type, routing number (if applicable), and account number.")}</li>
                    <li>{brandize("Recordkeeping: We collect and verify your information to safeguard the Platform, other users, and XchangeOn from illicit activity, and to comply with all applicable laws. You authorize us to retain this information for at least eight (8) years.")}</li>
                    <li>{brandize("Maintaining Up-to-Date Information: You must keep all your provided information true, accurate, and current. If any data you supplied is incorrect, misleading, outdated, or incomplete, XchangeOn may request corrections, remove the incorrect data, or suspend/terminate the Services we provide to you. If we cannot reach you at the contact details on file, you will be fully liable for any losses or expenses XchangeOn incurs due to your failure to update your information.")}</li>
                  </ol>
                  <p>{brandize("By registering, you authorize XchangeOn (or its third-party agents) to conduct any investigations we deem necessary to verify your identity or to protect you, other users, or XchangeOn from fraud or other financial crimes. You also agree that we may share your personal data with credit bureaus or fraud prevention agencies for these purposes, and that they may provide us with relevant information in return.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>10. AUTHORIZATION TO INQUIRE</h2>
                  <p>{brandize("You authorize XchangeOn to conduct, directly or through third parties, any investigations we deem necessary to verify your identity or to protect you and XchangeOn from fraud, money laundering, or other financial crimes.")}</p>
                  <p>{brandize("This includes authorizing your wireless operator (e.g., Etisalat, Du) to share with us your mobile number, name, address, email, network status, customer type, billing plan, device identifiers (IMSI, IMEI), and other subscriber details, solely for identity verification and comparison against the information you provided to us.")}</p>
                  <p>{brandize("When we perform these checks, you acknowledge that your personal data may be shared with credit bureaus and fraud-prevention or financial-crime agencies, and those agencies may respond fully to our inquiries. Such identity checks will not affect your credit rating.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>11. SECURING YOUR ACCOUNT</h2>
                  <p>{brandize("Your XchangeOn account is personal to you. If we suspect unauthorized use, we reserve the right, at our sole discretion, to suspend, restrict, or terminate your account. You assume full responsibility for any misuse of your login credentials.")}</p>
                  <ol>
                    <li>{brandize("Public/Shared Devices: If you log in from a public or shared computer, you must log out at the end of each session.")}</li>
                    <li>{brandize("Credential Security: You are responsible for safeguarding all IDs, passwords, PINs, API keys, or other access codes. If these credentials or your personal information are compromised, a third party may gain unauthorized access to your account, potentially resulting in the loss of virtual assets, fiat currency, or other funds held in your XchangeOn account or any linked bank/credit accounts.")}</li>
                    <li>{brandize("Contact Information: Keep your email address, phone number, and other contact details current so you can receive notices, alerts, and security prompts. We are not liable for any losses if your account credentials are compromised—through no fault of ours—or if you fail to act on notices or alerts we send.")}</li>
                    <li>{brandize("Multi-Factor Authentication: We may require you to use a device capable of installing and supporting multi-factor authentication. Even with MFA enabled, XchangeOn Services may be temporarily unavailable during periods of extreme market volatility or high volume, which could delay your ability to trade or our customer support response time.")}</li>
                  </ol>
                </section>

                <section className="agreement-section">
                  <h2>12. VIRTUAL ASSET SERVICES</h2>
                  <p>{brandize("XchangeOn Services enable you to buy, sell, and trade all virtual assets listed under our Virtual Asset Standards (collectively, ‘Virtual Assets’).")}</p>
                  <ol>
                    <li>{brandize("Virtual Asset Exchange: We match and execute orders to convert Virtual Assets into fiat currency or other Virtual Assets, based on the instructions you submit. Before placing any order, review your trade details and review any applicable fees—such as trading fees and network/miner fees. All fees are set forth in our Fee Schedule and displayed on the Platform before you confirm each transaction. XchangeOn will provide reasonable advance notice of any fee changes.")}</li>
                    <li>{brandize("Virtual Asset Withdrawals: After you initiate a withdrawal from your XchangeOn Wallet, the transaction enters a ‘pending’ state until the applicable blockchain network confirms it. Withdrawals remain unconfirmed—and not fully processed—while awaiting on-chain confirmations. XchangeOn does not guarantee that any withdrawal will be confirmed by the blockchain in a specific timeframe or at all.")}</li>
                    <li>{brandize("Virtual Asset Deposits: When you submit Virtual Assets for deposit into your XchangeOn Wallet, the deposit remains ‘pending’ until the relevant blockchain network confirms it. No deposit is final until sufficient network confirmations occur. XchangeOn does not warrant or guarantee that any deposit will be confirmed within a particular timeframe or at all.")}</li>
                    <li>{brandize("Virtual Asset Custody: USERS ARE ADVISED TO REVIEW THE PUBLIC DISCLOSURES, AND VIRTUAL ASSET CUSTODY POLICY TO KNOW MORE ABOUT OUR CUSTODY ARRANGEMENTS.")}</li>
                    <li>{brandize("Our Custody Arrangement is set out in detail on the Platform, including wallet controls, hot/cold storage allocation, and third-party custody arrangements.")}</li>
                  </ol>
                </section>

                <section className="agreement-section">
                  <h2>13. PENDING DEPOSITS OR WITHDRAWALS</h2>
                  <p>{brandize("Virtual asset transactions that remain in a pending state will be clearly designated as such and will not appear in your XchangeOn account balance nor be available for use. XchangeOn reserves the right to delay, refuse, or cancel any virtual asset withdrawal, deposit, or exchange if we reasonably suspect fraud or illicit activity.")}</p>
                  <p>{brandize("Additionally, we may refuse or cancel pending transactions to comply with applicable laws, subpoenas, court orders, or other binding government directives, or to enforce any account limits.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>14. SUPPORTED VIRTUAL ASSETS</h2>
                  <p>{brandize("XchangeOn’s list of supported Virtual Assets may change periodically, including at VARA’s direction. You must not attempt to use XchangeOn Services to store, send, request, or receive any Virtual Asset that we do not explicitly support. XchangeOn disclaims any responsibility for transactions involving unsupported assets. If we decide to delist a supported Virtual Asset, we will provide you with advance notice.")}</p>
                  <p>{brandize("The current list of supported Virtual Assets is published on the Platform and attached to this Agreement.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>15. FEES</h2>
                  <p>{brandize("You agree to pay all fees as described in the XchangeOn Fee Schedule. Refer to the Fee Schedule on the Platform for details (‘Fee Schedule’).")}</p>
                  <ul>
                    <li>Trading Fees: Calculated as &ldquo;amount × purchase price × fee rate,&rdquo; based on the tiered fee structure. Any unfilled portion of a canceled order will be refunded in full.</li>
                    <li>{brandize("Deposit & Withdrawal Fees: XchangeOn does not charge fees for deposits or withdrawals of either Virtual Assets or fiat, aside from any network or miner fees or fees charged by external payment networks.")}</li>
                  </ul>
                  <p>{brandize("You authorize XchangeOn to deduct any applicable fees directly from your Wallet balance. The Fee Schedule is attached to this Agreement.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>16. OPERATION OF VIRTUAL ASSET PROTOCOLS</h2>
                  <p>{brandize("XchangeOn neither owns nor controls the underlying open-source protocols that govern supported Virtual Assets. By using XchangeOn Services, you acknowledge and agree that:")}</p>
                  <ul>
                    <li>We make no guarantees regarding a protocol&rsquo;s functionality, security, or availability.</li>
                    <li>Protocol rules may change suddenly (e.g., &ldquo;forks&rdquo;), which can affect the value, name, or functionality of any Virtual Asset in your Wallet.</li>
                  </ul>
                  <p>{brandize("Typically, XchangeOn does not facilitate Airdrops (the distribution of new tokens triggered by network events). If we become aware of an Airdrop or fork that impacts our Platform or any supported Virtual Asset, we will evaluate and notify affected users. During such events, XchangeOn may temporarily suspend operations without prior notice. We may also decide, at our sole discretion, whether to support or cease supporting a forked protocol.")}</p>
                  <p>{brandize("XchangeOn is not liable for any user losses arising from unsupported forks or Airdrops.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>17. PAYMENT SERVICES, METHODS, AND FIAT DEPOSITS/WITHDRAWALS</h2>
                  <p>{brandize("You may deposit United States Dollars (USD), United Arab Emirates Dirham (AED), or other fiat currencies supported by XchangeOn (collectively, ‘Supported Fiat Currencies’) from your bank account via Automated Clearing House (ACH), wire transfer, or other payment methods that we support. When you deposit Supported Fiat Currencies, funds are transferred from your bank account into XchangeOn’s omnibus CMA, enabling you to hold and exchange fiat for supported Virtual Assets.")}</p>
                  <p>{brandize("The payment method you choose to fund the CMA is neither provided by nor included within XchangeOn Services. Instead, it is a separate service—offered by your bank or payment services providers (‘PSPs’)—that merely facilitates the transfer of fiat funds into and out of the CMA.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>18. PAYMENT METHODS</h2>
                  <p>{brandize("XchangeOn does not guarantee availability of any specific payment method and may change or discontinue support for payment options at any time. XchangeOn is responsible for securing funds that have been successfully credited to your XchangeOn account. However, we are not liable for funds that fail to arrive in your account due to factors beyond our control—such as incorrect payment instructions, errors by PSPs, or network disruptions.")}</p>
                  <p>{brandize("Likewise, we are not responsible for funds you have withdrawn to external accounts outside of XchangeOn.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>19. PAYMENT SERVICES PARTNERS</h2>
                  <p>{brandize("XchangeOn may utilize third-party payment processors to handle Supported Fiat Currency transactions—including deposits, withdrawals, and fiat-to-crypto exchanges—between you and XchangeOn.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>20. THIRD-PARTY SERVICE PROVIDERS</h2>
                  <p>{brandize("For operational purposes, XchangeOn may rely on third-party providers for services such as payment processing, AML/CFT screening, sanctions checks, and identity verification etc. XchangeOn may also contract with other Group affiliates for administrative, operational, or marketing services. A non-exhaustive list of third-party service providers is attached to this User Agreement.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>21. THIRD-PARTY APPLICATIONS</h2>
                  <p>{brandize("If you grant a third party permission to connect to your XchangeOn account—whether through their product or via our Platform—you remain fully responsible for all activity that third party performs on your behalf. Granting access does not relieve you of any obligations under this Agreement. You agree to indemnify XchangeOn for any liability arising from a third party’s acts or omissions. You may revoke third-party permissions at any time through the Platform.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>22. DEPOSITING FUNDS</h2>
                  <p>{brandize("When you deposit funds into your XchangeOn account, you may be prompted to answer security questions or complete additional verification steps—either by XchangeOn or by a third-party service—to confirm that you have authorized the transfer. Deposit limits are set dynamically based on factors such as the information you provided and the funding method you select. In some cases, your deposit limits may exceed your withdrawal or trading limits.")}</p>
                  <p>{brandize("Once we receive your instructions, deposited funds are typically credited to your XchangeOn account within one (1) business day. XchangeOn will debit your linked bank account immediately after you initiate the transfer. You agree not to deposit any funds into the CMA if you are not the named account holder on the sending bank account.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>23. EXCHANGING FUNDS</h2>
                  <p>{brandize("You may purchase supported Virtual Assets using the balance in your XchangeOn account, a valid bank account in your name, or a debit/credit card that matches your XchangeOn account name. All purchases must follow the payment instructions displayed on the Platform. If you fail to confirm a quoted price within five (5) seconds, XchangeOn reserves the right to cancel the transaction automatically.")}</p>
                  <p>{brandize("If we reject your order for any reason, we will notify you, and you will not incur any charges for the canceled transaction.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>24. TRANSACTION LIMITS</h2>
                  <p>{brandize("Your use of XchangeOn Services is subject to dynamic limits on trading volume, withdrawals, and other transactions (e.g., daily limits). These limits depend on factors such as your chosen payment method, completed verification steps, and your account profile. XchangeOn reserves the right to adjust these limits in its sole discretion. If you wish to increase your limits beyond the current thresholds, you may submit a request to [email protected].")}</p>
                  <p>{brandize("We may require additional documentation, meetings, or other information as dictated by our internal compliance policies and/or team. XchangeOn reserves the right to charge fees for processing such limit-increase requests—after providing you advance notice—and may, at any time, refuse to raise your limits or reduce them even if you have provided all requested information.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>25. REVERSALS AND CANCELLATIONS</h2>
                  <p>{brandize("Once a transaction is marked as ‘complete’ or ‘pending,’ it cannot be canceled, reversed, or modified. If your chosen payment method is declined or has insufficient funds, you authorize XchangeOn—at our discretion—to either cancel the transaction or debit another payment method you have on file (including your XchangeOn account balance or linked accounts) to complete the transaction.")}</p>
                  <p>You are solely responsible for maintaining sufficient balances or credit limits to avoid overdraft, non-sufficient funds, or similar fees from your payment provider.</p>
                  <p>{brandize("XchangeOn reserves the right, in its sole discretion, to refuse, cancel, or reverse any purchase or sale of Virtual Assets—even after debiting your account—if we determine that the transaction is suspicious, poses a high risk of money laundering, terrorist financing, fraud, or other financial crime, is erroneous, violates our Permitted Use Policy, or is required to comply with a subpoena, court order, or other binding government directive.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>26. UNAUTHORIZED, SUSPICIOUS, AND INCORRECT TRANSACTIONS</h2>
                  <p>{brandize("You are solely responsible for your XchangeOn account and any access thereto. XchangeOn processes Virtual Asset deposits, withdrawals, and trades strictly according to the instructions we receive. We do not verify the identity of any counterparty on the network or any recipient of a transaction. Unless you notify us in advance, we will assume that all activity and instructions for your account are authorized by you.")}</p>
                  <p>{brandize("XchangeOn has no obligation to confirm the identity or authority of anyone accessing or using your account.")}</p>
                  <p>{brandize("If you suspect unauthorized or suspicious activity on your account, contact us immediately at [email protected]. XchangeOn is not liable for any losses resulting from unauthorized, suspicious, or erroneous transactions that arise through no fault of ours. You agree to indemnify XchangeOn to the fullest extent permitted by applicable law. Any claim under this section is waived unless you notify us within one (1) year from the date the relevant transaction was posted to your XchangeOn account.")}</p>
                  <p>We encourage you to review your transaction history regularly and take action immediately if you find any inconsistencies in your transactions.</p>
                </section>

                <section className="agreement-section">
                  <h2>27. DEBTS</h2>
                  <p>{brandize("If you owe any fees or debts to XchangeOn for any reason, we may debit your XchangeOn account balance or withhold amounts from any transfers between your XchangeOn accounts to recover those debts.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>28. WITHDRAWING FUNDS</h2>
                  <p>{brandize("You may request a withdrawal of any portion of the funds held in your XchangeOn account at any time. The availability and method of withdrawal depend on the third-party financial institution handling the payout. XchangeOn does not guarantee that any particular withdrawal method will remain available and may add, modify, or suspend withdrawal options at its discretion.")}</p>
                  <p>{brandize("Your XchangeOn account is subject to dynamically adjusted withdrawal limits based on the information you have provided and your account status. If your withdrawal request exceeds your current limit, the request may be declined. XchangeOn may also require additional identity verification before processing a withdrawal. You agree not to withdraw funds to a bank account for which you are not the named account holder.")}</p>
                  <p>{brandize("It is your responsibility to ensure that all payment details entered—such as bank account numbers and routing codes—are accurate, complete, and up to date. XchangeOn is not liable for funds sent to an incorrect account or for any fees, costs, bank charges, or penalties incurred due to inaccurate withdrawal details.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>29. PLATFORM ACCURACY</h2>
                  <p>{brandize("While XchangeOn strives to provide accurate and timely information on the Platform, including all Content, it may not always be complete, current, or error-free. Information may change or be updated at any time without prior notice, including details about policies, agreements, products, or XchangeOn Services. You should independently verify any information before relying on it; any decisions based on Platform content are made at your own risk.")}</p>
                  <p>{brandize("XchangeOn disclaims liability for any losses arising from reliance on outdated, inaccurate, or incomplete information. Links to third-party websites or materials are provided only as a convenience. XchangeOn does not control or endorse third-party content, and is not responsible for information, content, or services on any linked site.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>30. LIMITED LICENSE</h2>
                  <p>{brandize("Subject to this Agreement, XchangeOn grants you a limited, nonexclusive, non-transferable license to access and use the XchangeOn Services and all associated content, materials, and information (collectively, the ‘Content’) solely for purposes approved by XchangeOn. Any other use of the Platform or Content is strictly prohibited. All rights, title, and interest in the Platform and Content remain exclusively with XchangeOn, its affiliates, or its licensors.")}</p>
                  <p>{brandize("You agree not to copy, transmit, distribute, sell, license, reverse-engineer, modify, publish, create derivative works from, or otherwise exploit any Content. ‘XchangeOn,’ ‘https://www.xchangeon.io’ and all logos related to XchangeOn Services are trademarks or registered marks of XchangeOn or its licensors, and may not be used without prior written permission.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>31. PROHIBITED USE</h2>
                  <p>{brandize("When using XchangeOn Services, interacting with other users, or engaging third parties, you must not engage in any activity that violates our Approved Use Policy. We reserve the right to monitor, review, retain, and/or disclose any information as necessary to comply with applicable laws, regulations, sanctions programs, legal processes, or government requests.")}</p>
                  <p>{brandize("If we determine—at our sole discretion—that your account is associated with prohibited activity or business, we may immediately suspend or terminate your account, block transactions, or freeze funds without prior notice. You may not use your XchangeOn account to engage in any of the following activities (‘Prohibited Uses’). The examples below are illustrative, not exhaustive:")}</p>
                  <ul>
                    <li>{brandize("Unlawful Activity: Any action that violates or facilitates the violation of laws, statutes, ordinances, or regulations—including sanctions programs enforced in jurisdictions where XchangeOn operates (e.g., OFAC)—or that involves proceeds of illegal activity. This includes publishing, distributing, or disseminating any illegal content.")}</li>
                    <li>{brandize("Abusive Activity: Actions that place an unreasonable or disproportionate strain on XchangeOn’s infrastructure; interfere with, intercept, or expropriate any system, data, or information; upload malware (e.g., viruses, trojans, worms) to the Platform; attempt unauthorized access to the Platform, other users’ accounts, or connected systems via password mining or other methods; or use someone else’s account information to access or use the Platform.")}</li>
                    <li>{brandize("Abuse of Other Users: Disrupt another individual’s or entity’s access to or use of XchangeOn Services; defame, harass, stalk, extort, threaten, or infringe upon others’ legal rights (including privacy, publicity, and intellectual property); incite or promote hate speech, racial intolerance, or violence; or harvest or collect personal information from the Platform (e.g., email addresses) without proper consent.")}</li>
                    <li>{brandize("Fraud: Any attempt to defraud XchangeOn, XchangeOn users, or any other person; providing false, inaccurate, or misleading information to XchangeOn.")}</li>
                    <li>Gambling: Any lotteries; bidding-fee auctions; sports betting or odds-making; fantasy sports with cash prizes; internet gaming; contests; sweepstakes; or games of chance.</li>
                    <li>{brandize("Intellectual Property Infringement: Transactions involving counterfeit or pirated materials (e.g., unauthorized distribution of protected music, movies, software, or other licensed content); unauthorized use of XchangeOn’s name, logo, trademarks, or service marks; or any action implying false endorsement or affiliation with XchangeOn.")}</li>
                  </ul>
                </section>

                <section className="agreement-section">
                  <h2>32. PROHIBITED BUSINESSES AND CONDITIONAL USE</h2>
                  <p>{brandize("In addition to the Prohibited Uses, you may not use XchangeOn Services in connection with prohibited businesses including restricted financial services, counterfeit goods, regulated products, drugs and paraphernalia, pseudo-pharmaceuticals, adult services, pyramid schemes, predatory practices, or any activity XchangeOn determines is high-risk.")}</p>
                  <p>{brandize("Conditional Uses (such as money services businesses, charities, games of skill, and certain religious/spiritual organizations) require XchangeOn’s prior written approval and may be subject to additional onboarding, representations, warranties, and controls.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>33. SUSPENSION, TERMINATION, AND CANCELLATION</h2>
                  <p>{brandize("XchangeOn may suspend, restrict, or terminate your access to any or all Services, and/or deactivate or cancel your account if required by law, if prohibited activity is suspected, if legal/regulatory risk exists, or if you attempt to circumvent controls (including opening multiple accounts or abusing promotions).")}</p>
                  <p>{brandize("Unless prohibited, we will notify you and provide a withdrawal opportunity for available balances. XchangeOn may freeze or seize funds to comply with valid legal or governmental directives.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>34. PROMOTIONS AND TERMS OF USE</h2>
                  <p>{brandize("XchangeOn may offer promotions, incentives, and bonus programmes at its sole discretion. Eligibility, availability, and terms may depend on geography, verification, volume, thresholds, holding periods, compliance status, and regulatory constraints.")}</p>
                  <p>{brandize("XchangeOn may modify, suspend, or terminate promotions at any time and may claw back benefits obtained via fraud, manipulation, or breaches.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>35. RISKS DISCLOSURE NOTICE</h2>
                  <p>Trading in virtual assets involves substantial risk of loss and may not be suitable for all investors. Virtual asset markets are highly volatile and subject to regulatory, technological, and operational risks.</p>
                  <p>{brandize("By using XchangeOn Services, you acknowledge and accept the Risk Disclosure Statement and your sole responsibility for suitability of use.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>36. INDEPENDENT CONTRACTOR RELATIONSHIP</h2>
                  <p>{brandize("XchangeOn acts only as an independent contractor and service provider. Nothing in this Agreement creates a partnership, agency, fiduciary, employment, or joint venture relationship.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>37. TAX OBLIGATIONS AND REPORTING</h2>
                  <p>{brandize("You are solely responsible for all taxes arising from your use of XchangeOn Services. XchangeOn may report account and transaction information to relevant authorities as required by law.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>38. UNCLAIMED PROPERTY AND DORMANT ACCOUNT MANAGEMENT</h2>
                  <p>{brandize("If your account becomes dormant and we cannot contact you for the statutory period, XchangeOn may be required to report and transfer unclaimed assets to relevant governmental authorities, after reasonable contact attempts.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>39. ADMINISTRATION</h2>
                  <p>{brandize("If XchangeOn receives credible proof of your death, your account may be frozen pending verification and lawful transfer instructions from your authorized representative or court-appointed administrator.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>40. CUSTOMER SUPPORT, LEGAL SERVICE, AND COMPLAINTS PROCEDURE</h2>
                  <p>{brandize("For support, security concerns, legal service, and formal complaints, you may contact XchangeOn through the official channels and registered office details set out on the Platform, including escalation rights to VARA where applicable.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>41. LIMITATION OF LIABILITY AND DISCLAIMER OF WARRANTIES</h2>
                  <p>{brandize("TO THE MAXIMUM EXTENT PERMITTED BY LAW, XCHANGEON DISCLAIMS LIABILITY FOR INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL LOSSES, AND PROVIDES SERVICES ON AN ‘AS IS’ AND ‘AS AVAILABLE’ BASIS WITHOUT WARRANTIES.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>42. ABSENCE OF DEPOSIT INSURANCE AND INTEREST</h2>
                  <p>{brandize("Virtual Assets and fiat held with XchangeOn are not insured under deposit protection schemes and do not accrue interest.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>43. COMPUTER VIRUSES AND SECURITY THREATS</h2>
                  <p>{brandize("XchangeOn is not liable for losses caused by malware, phishing, spoofing, or related security threats beyond its control. Users should apply appropriate cybersecurity measures.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>44. RELEASE AND INDEMNIFICATION FOR USER DISPUTES</h2>
                  <p>{brandize("You release XchangeOn and related parties from claims arising from disputes with other users.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>45. INDEMNITY</h2>
                  <p>{brandize("You agree to indemnify and hold harmless XchangeOn and related parties from losses arising from your use of the Platform, breach of this Agreement, or violation of law or third-party rights.")}</p>
                </section>

                <section className="agreement-section">
                  <h2>46. MISCELLANEOUS PROVISIONS</h2>
                  <ul>
                    <li>{brandize("Entire Agreement: This Agreement and incorporated policies form the complete understanding between you and XchangeOn.")}</li>
                    <li>{brandize("Assignment: You may not assign rights without XchangeOn consent. XchangeOn may assign rights to affiliates or successors.")}</li>
                    <li>{brandize("Severability: Invalid provisions are severed; remaining provisions remain effective.")}</li>
                    <li>{brandize("Change of Control: Data may transfer in merger/acquisition events, subject to Privacy Policy.")}</li>
                    <li>{brandize("Survival: Clauses intended to survive termination remain in effect.")}</li>
                    <li>{brandize("Governing Law: Laws of Dubai, UAE apply; Dubai courts have exclusive jurisdiction (excluding DIFC courts).")}</li>
                    <li>{brandize("Force Majeure: XchangeOn is not liable for delays or failures caused by events beyond reasonable control.")}</li>
                    <li>{brandize("Non-Waiver: Failure to enforce rights does not waive those rights.")}</li>
                  </ul>
                </section>

                <section className="agreement-section">
                  <h2>THIRD-PARTY SERVICE PROVIDERS</h2>
                  <div className="agreement-table-wrap">
                    <table className="agreement-table">
                      <thead>
                        <tr>
                          <th>Full Name</th>
                          <th>Services Provided</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Chainalysis</td>
                          <td>Wallet risk screening; AML reporting</td>
                        </tr>
                        <tr>
                          <td>Veriff</td>
                          <td>Automated ID and selfie verification</td>
                        </tr>
                        <tr>
                          <td>Veriff OÜ</td>
                          <td>Automated ID/selfie verification; sanctions, PEP, and adverse-media screening; automated Travel Rule compliance, and proof of address</td>
                        </tr>
                        <tr>
                          <td>Chainalysis UK Ltd</td>
                          <td>Wallet risk screening; transaction monitoring</td>
                        </tr>
                        <tr>
                          <td>Bank Name</td>
                          <td>Fiat custody and local payment services</td>
                        </tr>
                        <tr>
                          <td>LexisNexis Risk Solutions (Shanghai) Information Technologies Co., Ltd</td>
                          <td>Automated sanctions, PEP, and adverse-media screening</td>
                        </tr>
                        <tr>
                          <td>CLOUD INTENSE SOFTWARE</td>
                          <td>Technology services; product design services; administration, customer support; marketing and growth services</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="agreement-section">
                  <h2>SUPPORTED TRADING PAIRS</h2>
                  <div className="agreement-table-wrap">
                    <table className="agreement-table">
                      <thead>
                        <tr>
                          <th>Base Asset</th>
                          <th>USDT</th>
                          <th>BTC</th>
                          <th>ETH</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td>BTC</td><td>✓</td><td>N/A</td><td>X</td></tr>
                        <tr><td>ETH</td><td>✓</td><td>X</td><td>N/A</td></tr>
                        <tr><td>USDT</td><td>N/A</td><td>✓</td><td>✓</td></tr>
                        <tr><td>BNB</td><td>✓</td><td>X</td><td>X</td></tr>
                        <tr><td>XRP</td><td>✓</td><td>X</td><td>X</td></tr>
                        <tr><td>DOGE</td><td>✓</td><td>X</td><td>X</td></tr>
                        <tr><td>ADA</td><td>✓</td><td>X</td><td>X</td></tr>
                        <tr><td>POL (MATIC)</td><td>✓</td><td>X</td><td>X</td></tr>
                        <tr><td>DOT</td><td>✓</td><td>X</td><td>X</td></tr>
                        <tr><td>DAI</td><td>✓</td><td>X</td><td>X</td></tr>
                        <tr><td>LTC</td><td>✓</td><td>X</td><td>X</td></tr>
                        <tr><td>SHIB</td><td>✓</td><td>X</td><td>X</td></tr>
                        <tr><td>SOL</td><td>✓</td><td>X</td><td>X</td></tr>
                        <tr><td>UNI</td><td>✓</td><td>X</td><td>X</td></tr>
                        <tr><td>AVAX</td><td>✓</td><td>X</td><td>X</td></tr>
                        <tr><td>ATOM</td><td>✓</td><td>X</td><td>X</td></tr>
                        <tr><td>ETC</td><td>✓</td><td>X</td><td>X</td></tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              </article>
            </Col>
          </Row>
        </Container>
      </section>

      <NewsletterSection />
      <NavigationSection />
      <BottomBar />
    </>
  );
};

export default UserAgreement;
