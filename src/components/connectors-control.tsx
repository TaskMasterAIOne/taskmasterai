import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Workflow, CheckCircle } from 'lucide-react';

const NotionIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path className="fill-black dark:fill-white" d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
    </svg>
);

// --- SVG Icons ---
const GoogleIcon = ({ className }: { className?: string }) => (
  <svg version="1.1" viewBox="0 0 268.1522 273.8827" overflow="hidden" xmlSpace="preserve" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="a">
        <stop offset="0" stopColor="#0fbc5c"/>
        <stop offset="1" stopColor="#0cba65"/>
      </linearGradient>
      <linearGradient id="g">
        <stop offset=".2312727" stopColor="#0fbc5f"/>
        <stop offset=".3115468" stopColor="#0fbc5f"/>
        <stop offset=".3660131" stopColor="#0fbc5e"/>
        <stop offset=".4575163" stopColor="#0fbc5d"/>
        <stop offset=".540305" stopColor="#12bc58"/>
        <stop offset=".6993464" stopColor="#28bf3c"/>
        <stop offset=".7712418" stopColor="#38c02b"/>
        <stop offset=".8605665" stopColor="#52c218"/>
        <stop offset=".9150327" stopColor="#67c30f"/>
        <stop offset="1" stopColor="#86c504"/>
      </linearGradient>
      <linearGradient id="h">
        <stop offset=".1416122" stopColor="#1abd4d"/>
        <stop offset=".2475151" stopColor="#6ec30d"/>
        <stop offset=".3115468" stopColor="#8ac502"/>
        <stop offset=".3660131" stopColor="#a2c600"/>
        <stop offset=".4456735" stopColor="#c8c903"/>
        <stop offset=".540305" stopColor="#ebcb03"/>
        <stop offset=".6156363" stopColor="#f7cd07"/>
        <stop offset=".6993454" stopColor="#fdcd04"/>
        <stop offset=".7712418" stopColor="#fdce05"/>
        <stop offset=".8605661" stopColor="#ffce0a"/>
      </linearGradient>
      <linearGradient id="f">
        <stop offset=".3159041" stopColor="#ff4c3c"/>
        <stop offset=".6038179" stopColor="#ff692c"/>
        <stop offset=".7268366" stopColor="#ff7825"/>
        <stop offset=".884534" stopColor="#ff8d1b"/>
        <stop offset="1" stopColor="#ff9f13"/>
      </linearGradient>
      <linearGradient id="b">
        <stop offset=".2312727" stopColor="#ff4541"/>
        <stop offset=".3115468" stopColor="#ff4540"/>
        <stop offset=".4575163" stopColor="#ff4640"/>
        <stop offset=".540305" stopColor="#ff473f"/>
        <stop offset=".6993464" stopColor="#ff5138"/>
        <stop offset=".7712418" stopColor="#ff5b33"/>
        <stop offset=".8605665" stopColor="#ff6c29"/>
        <stop offset="1" stopColor="#ff8c18"/>
      </linearGradient>
      <linearGradient id="d">
        <stop offset=".4084578" stopColor="#fb4e5a"/>
        <stop offset="1" stopColor="#ff4540"/>
      </linearGradient>
      <linearGradient id="c">
        <stop offset=".1315461" stopColor="#0cba65"/>
        <stop offset=".2097843" stopColor="#0bb86d"/>
        <stop offset=".2972969" stopColor="#09b479"/>
        <stop offset=".3962575" stopColor="#08ad93"/>
        <stop offset=".4771242" stopColor="#0aa6a9"/>
        <stop offset=".5684245" stopColor="#0d9cc6"/>
        <stop offset=".667385" stopColor="#1893dd"/>
        <stop offset=".7687273" stopColor="#258bf1"/>
        <stop offset=".8585063" stopColor="#3086ff"/>
      </linearGradient>
      <linearGradient id="e">
        <stop offset=".3660131" stopColor="#ff4e3a"/>
        <stop offset=".4575163" stopColor="#ff8a1b"/>
        <stop offset=".540305" stopColor="#ffa312"/>
        <stop offset=".6156363" stopColor="#ffb60c"/>
        <stop offset=".7712418" stopColor="#ffcd0a"/>
        <stop offset=".8605665" stopColor="#fecf0a"/>
        <stop offset=".9150327" stopColor="#fecf08"/>
        <stop offset="1" stopColor="#fdcd01"/>
      </linearGradient>
      <linearGradient xlinkHref="#a" id="s" x1="219.6997" y1="329.5351" x2="254.4673" y2="329.5351" gradientUnits="userSpaceOnUse"/>
      <radialGradient xlinkHref="#b" id="m" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-1.936885,1.043001,1.455731,2.555422,290.5254,-400.6338)" cx="109.6267" cy="135.8619" fx="109.6267" fy="135.8619" r="71.46001"/>
      <radialGradient xlinkHref="#c" id="n" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-3.512595,-4.45809,-1.692547,1.260616,870.8006,191.554)" cx="45.25866" cy="279.2738" fx="45.25866" fy="279.2738" r="71.46001"/>
      <radialGradient xlinkHref="#d" id="l" cx="304.0166" cy="118.0089" fx="304.0166" fy="118.0089" r="47.85445" gradientTransform="matrix(2.064353,-4.926832e-6,-2.901531e-6,2.592041,-297.6788,-151.7469)" gradientUnits="userSpaceOnUse"/>
      <radialGradient xlinkHref="#e" id="o" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-0.2485783,2.083138,2.962486,0.3341668,-255.1463,-331.1636)" cx="181.001" cy="177.2013" fx="181.001" fy="177.2013" r="71.46001"/>
      <radialGradient xlinkHref="#f" id="p" cx="207.6733" cy="108.0972" fx="207.6733" fy="108.0972" r="41.1025" gradientTransform="matrix(-1.249206,1.343263,-3.896837,-3.425693,880.5011,194.9051)" gradientUnits="userSpaceOnUse"/>
      <radialGradient xlinkHref="#g" id="r" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-1.936885,-1.043001,1.455731,-2.555422,290.5254,838.6834)" cx="109.6267" cy="135.8619" fx="109.6267" fy="135.8619" r="71.46001"/>
      <radialGradient xlinkHref="#h" id="j" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-0.081402,-1.93722,2.926737,-0.1162508,-215.1345,632.8606)" cx="154.8697" cy="145.9691" fx="154.8697" fy="145.9691" r="71.46001"/>
      <filter id="q" x="-.04842873" y="-.0582241" width="1.096857" height="1.116448" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation="1.700914"/>
      </filter>
      <filter id="k" x="-.01670084" y="-.01009856" width="1.033402" height="1.020197" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation=".2419367"/>
      </filter>
      <clipPath clipPathUnits="userSpaceOnUse" id="i">
        <path d="M371.3784 193.2406H237.0825v53.4375h77.167c-1.2405 7.5627-4.0259 15.0024-8.1049 21.7862-4.6734 7.7723-10.4511 13.6895-16.373 18.1957-17.7389 13.4983-38.42 16.2584-52.7828 16.2584-36.2824 0-67.2833-23.2865-79.2844-54.9287-.4843-1.1482-.8059-2.3344-1.1975-3.5068-2.652-8.0533-4.101-16.5825-4.101-25.4474 0-9.226 1.5691-18.0575 4.4301-26.3985 11.2851-32.8967 42.9849-57.4674 80.1789-57.4674 7.4811 0 14.6854.8843 21.5173 2.6481 15.6135 4.0309 26.6578 11.9698 33.4252 18.2494l40.834-39.7111c-24.839-22.616-57.2194-36.3201-95.8444-36.3201-30.8782-.00066-59.3863 9.55308-82.7477 25.6992-18.9454 13.0941-34.4833 30.6254-44.9695 50.9861-9.75366 18.8785-15.09441 39.7994-15.09441 62.2934 0 22.495 5.34891 43.6334 15.10261 62.3374v.126c10.3023 19.8567 25.3678 36.9537 43.6783 49.9878 15.9962 11.3866 44.6789 26.5516 84.0307 26.5516 22.6301 0 42.6867-4.0517 60.3748-11.6447 12.76-5.4775 24.0655-12.6217 34.3012-21.8036 13.5247-12.1323 24.1168-27.1388 31.3465-44.4041 7.2297-17.2654 11.097-36.7895 11.097-57.957 0-9.858-.9971-19.8694-2.6881-28.9684Z" fill="#000"/>
      </clipPath>
    </defs>
    <g transform="matrix(0.957922,0,0,0.985255,-90.17436,-78.85577)">
      <g clipPath="url(#i)">
        <path d="M92.07563 219.9585c.14844 22.14 6.5014 44.983 16.11767 63.4234v.1269c6.9482 13.3919 16.4444 23.9704 27.2604 34.4518l65.326-23.67c-12.3593-6.2344-14.2452-10.0546-23.1048-17.0253-9.0537-9.0658-15.8015-19.4735-20.0038-31.677h-.1693l.1693-.1269c-2.7646-8.0587-3.0373-16.6129-3.1393-25.5029Z" fill="url(#j)" filter="url(#k)"/>
        <path d="M237.0835 79.02491c-6.4568 22.52569-3.988 44.42139 0 57.16129 7.4561.0055 14.6388.8881 21.4494 2.6464 15.6135 4.0309 26.6566 11.97 33.424 18.2496l41.8794-40.7256c-24.8094-22.58904-54.6663-37.2961-96.7528-37.33169Z" fill="url(#l)" filter="url(#k)"/>
        <path d="M236.9434 78.84678c-31.6709-.00068-60.9107 9.79833-84.8718 26.35902-8.8968 6.149-17.0612 13.2521-24.3311 21.1509-1.9045 17.7429 14.2569 39.5507 46.2615 39.3702 15.5284-17.9373 38.4946-29.5427 64.0561-29.5427.0233 0 .046.0019.0693.002l-1.0439-57.33536c-.0472-.00003-.0929-.00406-.1401-.00406Z" fill="url(#m)" filter="url(#k)"/>
        <path d="m341.4751 226.3788-28.2685 19.2848c-1.2405 7.5627-4.0278 15.0023-8.1068 21.7861-4.6734 7.7723-10.4506 13.6898-16.3725 18.196-17.7022 13.4704-38.3286 16.2439-52.6877 16.2553-14.8415 25.1018-17.4435 37.6749 1.0439 57.9342 22.8762-.0167 43.157-4.1174 61.0458-11.7965 12.9312-5.551 24.3879-12.7913 34.7609-22.0964 13.7061-12.295 24.4421-27.5034 31.7688-45.0003 7.3267-17.497 11.2446-37.2822 11.2446-58.7336Z" fill="url(#n)" filter="url(#k)"/>
        <path d="M234.9956 191.2104v57.4981h136.0062c1.1962-7.8745 5.1523-18.0644 5.1523-26.5001 0-9.858-.9963-21.899-2.6873-30.998Z" fill="#3086ff" filter="url(#k)"/>
        <path d="M128.3894 124.3268c-8.393 9.1191-15.5632 19.326-21.2483 30.3646-9.75351 18.8785-15.09402 41.8295-15.09402 64.3235 0 .317.02642.6271.02855.9436 4.31953 8.2244 59.66647 6.6495 62.45617 0-.0035-.3103-.0387-.6128-.0387-.9238 0-9.226 1.5696-16.0262 4.4306-24.3672 3.5294-10.2885 9.0557-19.7628 16.1223-27.9257 1.6019-2.0309 5.8748-6.3969 7.1214-9.0157.4749-.9975-.8621-1.5574-.9369-1.9085-.0836-.3927-1.8762-.0769-2.2778-.3694-1.2751-.9288-3.8001-1.4138-5.3334-1.8449-3.2772-.9215-8.7085-2.9536-11.7252-5.0601-9.5357-6.6586-24.417-14.6122-33.5047-24.2164Z" fill="url(#o)" filter="url(#k)"/>
        <path d="M162.0989 155.8569c22.1123 13.3013 28.4714-6.7139 43.173-12.9771L179.698 90.21568c-9.4075 3.92642-18.2957 8.80465-26.5426 14.50442-12.316 8.5122-23.192 18.8995-32.1763 30.7204Z" fill="url(#p)" filter="url(#q)"/>
        <path d="M171.0987 290.222c-29.6829 10.6413-34.3299 11.023-37.0622 29.2903 5.2213 5.0597 10.8312 9.74 16.7926 13.9835 15.9962 11.3867 46.766 26.5517 86.1178 26.5517.0462 0 .0904-.004.1366-.004v-59.1574c-.0298.0001-.064.002-.0938.002-14.7359 0-26.5113-3.8435-38.5848-10.5273-2.9768-1.6479-8.3775 2.7772-11.1229.799-3.7865-2.7284-12.8991 2.3508-16.1833-.9378Z" fill="url(#r)" filter="url(#k)"/>
        <path d="M219.6997 299.0227v59.9959c5.506.6402 11.2361 1.0289 17.2472 1.0289 6.0259 0 11.8556-.3073 17.5204-.8723v-59.7481c-6.3482 1.0777-12.3272 1.461-17.4776 1.461-5.9318 0-11.7005-.6858-17.29-1.8654Z" opacity=".5" fill="url(#s)" filter="url(#k)"/>
      </g>
    </g>
  </svg>
);
const DesmosIcon = ({ className }: { className?: string }) => ( <svg id="Desmos_Logo" data-name="Desmos Logo" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="-10 0 276 276" className={className} preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="desmos-linear-gradient" y1="1080" x2="1" y2="1080" gradientTransform="matrix(0, 202, 202, 0, -217488, 439)" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#158f48"/><stop offset="1" stopColor="#0f6733"/></linearGradient><linearGradient id="desmos-linear-gradient-2" y1="1079.68536" x2="1" y2="1079.68536" gradientTransform="matrix(0, 202, 202, 0, -217488, 439)" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#fff"/><stop offset="1" stopColor="#fff"/></linearGradient><linearGradient id="desmos-linear-gradient-3" y1="1080" y2="1080" xlinkHref="#desmos-linear-gradient-2"/><linearGradient id="desmos-linear-gradient-4" y1="1079.95843" y2="1079.95843" xlinkHref="#desmos-linear-gradient-2"/><linearGradient id="desmos-linear-gradient-5" y1="1080.26677" y2="1080.26677" xlinkHref="#desmos-linear-gradient-2"/></defs><g id="Icon" transform="scale(1.3) translate(-570 -430)"><path d="M669.84393,599.54407c-18.24481,0-29.71307-15.70441-35.97625-24.00019l10.12359-10.2138c2.7218,3.40646,12.90729,19.14911,25.95465,19.14911a18.68036,18.68036,0,0,0,11.56879-4.34638s7.72064,6.75678,11.82373,8.84479c0,0-7.67688,10.51166-23.38239,10.56628l-.11212.00019m90.53681-45.07331h-.02765c-13.67682.02918-30.17676,34.23536-52.47077,34.23536-23.32373,0-38.05859-34.08106-52.58831-34.08106-15.82325,0-30.00006,34.08106-52.58789,34.08106-12.10267,0-21.63141-8.95026-31.70606-18.60822v26.84341A44.05844,44.05844,0,0,0,615.05859,641H728.94147a44.05842,44.05842,0,0,0,44.05847-44.05872V560.35889c-2.07135-2.00617-6.82825-5.8877-12.6192-5.88813M728.94147,438.99994H615.05859a43.913,43.913,0,0,0-17.77771,3.73382c6.87159,24.95673,22.83289,80.10926,35.39307,101.9997-3.78967,3.73041-7.14954,6.80072-11.027,10.61914-10.74994-16.31024-29.82165-78.20837-37.43439-103.75323a43.9257,43.9257,0,0,0-13.21246,31.45928v66.38514c11.61658,9.44256,21.08045,24.02719,31.6203,24.02719l.08576-.00031C617.49951,573.35931,631.35309,540,655.294,540c24.412,0,35.17663,33.294,52.353,33.294C724.17627,573.294,736.61774,540,760,540a27.799,27.799,0,0,1,12.99994,3.21344V483.05865a43.99331,43.99331,0,0,0-17.49066-35.1502c-7.37067,30.04168-24.31458,87.99005-46.39167,121.9002a24.95592,24.95592,0,0,1-12.853-7.48547c22.79944-34.376,43.62091-110.397,46.48785-121.11517a44.02056,44.02056,0,0,0-13.811-2.20807" fill="url(#desmos-linear-gradient)" transform="translate(0, 0)"/><path d="M597.28088,442.73376a44.12808,44.12808,0,0,0-13.06836,8.86561c7.61274,25.54486,26.68445,87.443,37.43439,103.75323,3.8775-3.81842,7.23737-6.88873,11.027-10.61914-12.56018-21.89044-28.52148-77.043-35.39307-101.9997" fill="url(#desmos-linear-gradient-2)" transform="translate(0, 0)"/><path d="M760,540c-23.38226,0-35.82373,33.294-52.353,33.294-17.17639,0-27.941-33.294-52.353-33.294-23.94092,0-37.7945,33.35931-52.58789,33.47067l-.08576.00031c-10.53985,0-20.00372-14.58463-31.6203-24.02719V570.0979c10.07465,9.658,19.60339,18.60822,31.70606,18.60822,22.58783,0,36.76464-34.08106,52.58789-34.08106,14.52972,0,29.26458,34.08106,52.58831,34.08106,22.294,0,38.79395-34.20618,52.47077-34.23536h.02765c5.791.00043,10.54785,3.882,12.6192,5.88813V543.21344A27.799,27.799,0,0,0,760,540" fill="url(#desmos-linear-gradient-3)" transform="translate(0, 0)"/><path d="M643.99127,565.33008l-10.12359,10.2138c6.26318,8.29578,17.73144,24.00019,35.97625,24.00019l.11212-.00019c15.70551-.05462,23.38239-10.56628,23.38239-10.56628-4.10309-2.088-11.82373-8.84479-11.82373-8.84479a18.68036,18.68036,0,0,1-11.56879,4.34638c-13.04736,0-23.23285-15.74265-25.95465-19.14911" fill="url(#desmos-linear-gradient-4)" transform="translate(0, 0)"/><path d="M742.75244,441.208c-2.86694,10.7182-23.68841,86.73919-46.48785,121.11517a24.95592,24.95592,0,0,0,12.853,7.48547c22.07709-33.91015,39.021-91.85852,46.39167-121.9002a43.92448,43.92448,0,0,0-12.75684-6.70044" fill="url(#desmos-linear-gradient-5)" transform="translate(0, 0)"/></g></svg>);
const KhanAcademyIcon = ({ className }: { className?: string }) => ( <svg viewBox="-10 0 276 276" version="1.1" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid" className={className}><g> <path d="M16.2524996,57.1547059 C6.70984964,63.1945026 0.660185591,73.4605992 0,84.7347053 L0,191.114703 C0.660185591,202.388809 6.70984964,212.654905 16.2524996,218.694702 L111.698997,272.081701 C121.951702,277.105311 133.951292,277.105311 144.203997,272.081701 L239.748994,218.694702 C249.291644,212.654905 255.341308,202.388809 256.001494,191.114703 L256.001494,84.7347053 C255.341308,73.4605992 249.291644,63.1945026 239.748994,57.1547059 L144.302497,3.76770718 C134.049792,-1.25590239 122.050202,-1.25590239 111.797497,3.76770718 L16.2524996,57.1547059 Z" fill="#14BF96"> </path> <path d="M226.057495,111.526705 C173.064496,111.526705 133.467497,155.457704 133.467497,209.337202 L133.467497,211.602702 L122.829497,211.602702 L122.829497,209.337202 C122.829497,155.457704 83.4294981,111.723705 30.0411256,111.526705 C30.0411256,114.875705 30.0411256,118.323205 30.0411256,121.376704 C29.8270913,162.138126 54.9627136,198.741876 93.0824978,213.178702 C104.410162,217.33234 116.378824,219.466029 128.443997,219.482702 C140.605396,219.466096 152.67111,217.332931 164.100996,213.178702 C202.16354,198.686189 227.244797,162.10445 227.04371,121.376704 C226.549995,118.224705 226.352995,114.875705 226.057495,111.526705 Z" fill="#FFFFFF"> </path> <circle fill="#FFFFFF" cx="128.049997" cy="86.1137053" r="29.5499993"> </circle> </g></svg>);
const CanvasIcon = ({ className }: { className?: string }) => ( <svg fill="#E72429" viewBox="0 0 1920 1920" xmlns="http://www.w3.org/2000/svg" className={className}><path d="M958.568 277.97C1100.42 277.97 1216.48 171.94 1233.67 34.3881 1146.27 12.8955 1054.57 0 958.568 0 864.001 0 770.867 12.8955 683.464 34.3881 700.658 171.94 816.718 277.97 958.568 277.97ZM35.8207 682.031C173.373 699.225 279.403 815.285 279.403 957.136 279.403 1098.99 173.373 1215.05 35.8207 1232.24 12.8953 1144.84 1.43262 1051.7 1.43262 957.136 1.43262 862.569 12.8953 769.434 35.8207 682.031ZM528.713 957.142C528.713 1005.41 489.581 1044.55 441.31 1044.55 393.038 1044.55 353.907 1005.41 353.907 957.142 353.907 908.871 393.038 869.74 441.31 869.74 489.581 869.74 528.713 908.871 528.713 957.142ZM1642.03 957.136C1642.03 1098.99 1748.06 1215.05 1885.61 1232.24 1908.54 1144.84 1920 1051.7 1920 957.136 1920 862.569 1908.54 769.434 1885.61 682.031 1748.06 699.225 1642.03 815.285 1642.03 957.136ZM1567.51 957.142C1567.51 1005.41 1528.38 1044.55 1480.11 1044.55 1431.84 1044.55 1392.71 1005.41 1392.71 957.142 1392.71 908.871 1431.84 869.74 1480.11 869.74 1528.38 869.74 1567.51 908.871 1567.51 957.142ZM958.568 1640.6C816.718 1640.6 700.658 1746.63 683.464 1884.18 770.867 1907.11 864.001 1918.57 958.568 1918.57 1053.14 1918.57 1146.27 1907.11 1233.67 1884.18 1216.48 1746.63 1100.42 1640.6 958.568 1640.6ZM1045.98 1480.11C1045.98 1528.38 1006.85 1567.51 958.575 1567.51 910.304 1567.51 871.172 1528.38 871.172 1480.11 871.172 1431.84 910.304 1392.71 958.575 1392.71 1006.85 1392.71 1045.98 1431.84 1045.98 1480.11ZM1045.98 439.877C1045.98 488.148 1006.85 527.28 958.575 527.28 910.304 527.28 871.172 488.148 871.172 439.877 871.172 391.606 910.304 352.474 958.575 352.474 1006.85 352.474 1045.98 391.606 1045.98 439.877ZM1441.44 1439.99C1341.15 1540.29 1333.98 1697.91 1418.52 1806.8 1579 1712.23 1713.68 1577.55 1806.82 1418.5 1699.35 1332.53 1541.74 1339.7 1441.44 1439.99ZM1414.21 1325.37C1414.21 1373.64 1375.08 1412.77 1326.8 1412.77 1278.53 1412.77 1239.4 1373.64 1239.4 1325.37 1239.4 1277.1 1278.53 1237.97 1326.8 1237.97 1375.08 1237.97 1414.21 1277.1 1414.21 1325.37ZM478.577 477.145C578.875 376.846 586.039 219.234 501.502 110.339 341.024 204.906 206.338 339.592 113.203 498.637 220.666 584.607 378.278 576.01 478.577 477.145ZM679.155 590.32C679.155 638.591 640.024 677.723 591.752 677.723 543.481 677.723 504.349 638.591 504.349 590.32 504.349 542.048 543.481 502.917 591.752 502.917 640.024 502.917 679.155 542.048 679.155 590.32ZM1440 475.712C1540.3 576.01 1697.91 583.174 1806.8 498.637 1712.24 338.159 1577.55 203.473 1418.51 110.339 1332.54 217.801 1341.13 375.413 1440 475.712ZM1414.21 590.32C1414.21 638.591 1375.08 677.723 1326.8 677.723 1278.53 677.723 1239.4 638.591 1239.4 590.32 1239.4 542.048 1278.53 502.917 1326.8 502.917 1375.08 502.917 1414.21 542.048 1414.21 590.32ZM477.145 1438.58C376.846 1338.28 219.234 1331.12 110.339 1415.65 204.906 1576.13 339.593 1710.82 498.637 1805.39 584.607 1696.49 577.443 1538.88 477.145 1438.58ZM679.155 1325.37C679.155 1373.64 640.024 1412.77 591.752 1412.77 543.481 1412.77 504.349 1373.64 504.349 1325.37 504.349 1277.1 543.481 1237.97 591.752 1237.97 640.024 1237.97 679.155 1277.1 679.155 1325.37Z"></path></svg>);
const GoogleClassroomIcon = ({ className }: { className?: string }) => ( <svg version="1.1" id="Livello_1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 578.9 500" enableBackground="new 0 0 578.9 500" xmlSpace="preserve" className={className}><g> <path fill="#0F9D58" d="M52.6,52.6h473.7v394.7H52.6V52.6z"/> <path fill="#57BB8A" d="M394.7,263.2c16.4,0,29.6-13.3,29.6-29.6s-13.3-29.6-29.6-29.6s-29.6,13.3-29.6,29.6 S378.4,263.2,394.7,263.2L394.7,263.2z M394.7,282.9c-31.7,0-65.8,16.8-65.8,37.6v21.6h131.6v-21.6 C460.5,299.7,426.4,282.9,394.7,282.9z M184.2,263.2c16.4,0,29.6-13.3,29.6-29.6s-13.3-29.6-29.6-29.6s-29.6,13.3-29.6,29.6 S167.9,263.2,184.2,263.2L184.2,263.2z M184.2,282.9c-31.7,0-65.8,16.8-65.8,37.6v21.6H250v-21.6 C250,299.7,215.9,282.9,184.2,282.9z"/> <path fill="#F7F7F7" d="M289.5,236.8c21.8,0,39.5-17.7,39.4-39.5c0-21.8-17.7-39.5-39.5-39.4c-21.8,0-39.4,17.7-39.4,39.5 C250,219.2,267.7,236.8,289.5,236.8z M289.5,263.2c-44.4,0-92.1,23.6-92.1,52.6v26.3h184.2v-26.3 C381.6,286.7,333.9,263.2,289.5,263.2z"/> <path fill="#F1F1F1" d="M342.1,421.1h118.4v26.3H342.1V421.1z"/> <path fill="#F4B400" d="M539.5,0h-500C17.7,0,0,17.7,0,39.5v421.1C0,482.3,17.7,500,39.5,500h500c21.8,0,39.5-17.7,39.5-39.5V39.5 C578.9,17.7,561.3,0,539.5,0z M526.3,447.4H52.6V52.6h473.7V447.4z"/> <path opacity="0.2" fill="#FFFFFF" enableBackground="new    " d="M539.5,0h-500C17.7,0,0,17.7,0,39.5v3.3C0,21,17.7,3.3,39.5,3.3 h500c21.8,0,39.5,17.7,39.5,39.5v-3.3C578.9,17.7,561.3,0,539.5,0z"/> <path opacity="0.2" fill="#BF360C" enableBackground="new    " d="M539.5,496.7h-500C17.7,496.7,0,479,0,457.2v3.3 C0,482.3,17.7,500,39.5,500h500c21.8,0,39.5-17.7,39.5-39.5v-3.3C578.9,479,561.3,496.7,539.5,496.7z"/> <linearGradient id="gc-grad-1" gradientUnits="userSpaceOnUse" x1="154.8649" y1="295.747" x2="154.8649" y2="282.6343" gradientTransform="matrix(12.992 0 0 -4 -1584.6235 1631.0867)"> <stop offset="0" style={{stopColor:'#BF360C',stopOpacity:'0.2'}}/> <stop offset="1" style={{stopColor:'#BF360C',stopOpacity:'2.000000e-02'}}/> </linearGradient> <path fill="url(#gc-grad-1)" d="M460.3,447.4H341.9l52.6,52.6h118.3L460.3,447.4z"/> <path opacity="0.2" fill="#263238" enableBackground="new    " d="M52.6,49.3h473.7v3.3H52.6V49.3z"/> <path opacity="0.2" fill="#FFFFFF" enableBackground="new    " d="M52.6,447.4h473.7v3.3H52.6V447.4z"/> <radialGradient id="gc-grad-2" cx="131.4012" cy="367.2001" r="18.1966" gradientTransform="matrix(38.0002 0 0 -38 -4973.3276 13965.3232)" gradientUnits="userSpaceOnUse"> <stop offset="0" style={{stopColor:'#FFFFFF',stopOpacity:'0.1'}}/> <stop offset="1" style={{stopColor:'#FFFFFF',stopOpacity:'0'}}/> </radialGradient> <path fill="url(#gc-grad-2)" d="M539.5,0h-500C17.7,0,0,17.7,0,39.5v421.1C0,482.3,17.7,500,39.5,500h500 c21.8,0,39.5-17.7,39.5-39.5V39.5C578.9,17.7,561.3,0,539.5,0z"/> </g></svg>);

interface ConnectorsControlProps {
  isNotionConnected: boolean;
  isNotionSearchModeActive: boolean;
  onToggleNotionSearchMode: () => void;
  isGoogleConnected?: boolean;
  // Add future props for other connectors here
}

export function ConnectorsControl({
  isNotionConnected,
  isNotionSearchModeActive,
  onToggleNotionSearchMode,
  isGoogleConnected = false,
}: ConnectorsControlProps) {
  const connectors = [
    { name: 'Notion', icon: <NotionIcon className="w-6 h-6 fill-current" />, isConnected: isNotionConnected, onClick: onToggleNotionSearchMode, isActive: isNotionSearchModeActive, disabled: !isNotionConnected, beta: false },
    { name: 'Google', icon: <GoogleIcon className="w-6 h-6" />, isConnected: isGoogleConnected, disabled: !isGoogleConnected, beta: false },
    { name: 'Canvas', icon: <CanvasIcon className="w-6 h-6" />, isConnected: false, disabled: true },
    { name: 'Desmos', icon: <DesmosIcon className="w-6 h-6" />, isConnected: false, disabled: true },
    { name: 'Khan Academy', icon: <KhanAcademyIcon className="w-6 h-6" />, isConnected: false, disabled: true },
    { name: 'Google Classroom', icon: <GoogleClassroomIcon className="w-6 h-6" />, isConnected: false, disabled: true },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[15px] font-medium transition-colors duration-150 text-[var(--text-secondary)] hover:bg-[var(--interactive-hover)]"
          title="Manage Connectors"
        >
          <Workflow className="w-4 h-4" />
          <span className="hidden sm:inline">Connectors</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 bg-[var(--bg-primary)] shadow-xl rounded-lg border border-[var(--border-primary)] font-clarika z-[99]"
        align="start"
        side="top"
        sideOffset={8}
      >
        <div className="p-3 border-b border-[var(--border-primary)]">
          <h4 className="font-semibold text-[var(--text-primary)]">Connect Your Apps</h4>
          <p className="text-xs text-[var(--text-muted)]">Expand TaskMaster's capabilities.</p>
        </div>
        <div className="p-2 space-y-1">
          {connectors.map((item) => (
            <button
              key={item.name}
              onClick={item.disabled ? undefined : item.onClick}
              disabled={item.disabled}
              className={`w-full flex items-center justify-between p-2.5 rounded-md text-left transition-colors duration-150 group
                ${item.disabled
                  ? 'cursor-not-allowed opacity-50'
                  : item.isActive 
                    ? 'bg-[var(--interactive-hover)] hover:bg-[var(--interactive-active)]'
                    : 'hover:bg-[var(--interactive-hover)]'
                }`}
            >
             <div className="flex items-center gap-3">
                {item.icon}
                {/* --- CHANGE #3: Add a container to group the name and tag --- */}
                <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-[var(--text-primary)]">
                        {item.name}
                    </p>
                    {item.beta && (
                        <span className="bg-[var(--bg-accent)] text-[var(--text-white)] text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                            BETA
                        </span>
                    )}
                </div>
              </div>
              
              {item.disabled && (item.name === 'Canvas' || item.name === 'Desmos' || item.name === 'Khan Academy' || item.name === 'Google Classroom') ? (
                <span className="text-xs font-semibold text-[var(--text-muted)]">Coming Soon</span>
              ) : item.disabled && (item.name === 'Google' || item.name === 'Notion') ? (
                <span className="text-xs font-semibold text-[var(--text-muted)]">Not Connected</span>
              ) : (
                item.isConnected && (
                  <div className="text-xs font-semibold flex items-center gap-1 text-[var(--status-success)]">
                    <CheckCircle className="w-4 h-4" />
                    <span>Active</span>
                  </div>
                )
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
